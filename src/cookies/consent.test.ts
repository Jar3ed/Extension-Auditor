import { describe, expect, it } from "vitest";
import { consentWritesFor, type WriteContext } from "./cmpDictionary";
import {
  applyConsentWrites,
  learnCmp,
  MARKER_COOKIE,
  readCookie,
  readLearnedCmps,
  type CookieJar,
} from "./consentWriter";
import { parseCookieSettings, shouldSendGpc } from "./preferences";

const ctx: WriteContext = {
  now: Date.UTC(2026, 0, 15, 12),
  randomId: "abc123",
};

function fakeJar(initial = ""): CookieJar & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  for (const part of initial.split("; ").filter(Boolean)) {
    const eq = part.indexOf("=");
    raw.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return {
    raw,
    get: () => [...raw].map(([k, v]) => `${k}=${v}`).join("; "),
    set(cookie) {
      const pair = cookie.split(";")[0] ?? "";
      const eq = pair.indexOf("=");
      raw.set(pair.slice(0, eq), pair.slice(eq + 1));
    },
  };
}

describe("consentWritesFor", () => {
  const byName = (writes: ReturnType<typeof consentWritesFor>) =>
    new Map(
      writes.flatMap((w) => (w.kind === "cookie" ? [[w.name, w.value]] : [])),
    );

  it("OneTrust: necessary group on, everything else off unless accept_all", () => {
    const denied = byName(consentWritesFor("deny_all", ctx));
    const groups = decodeURIComponent(
      /groups=([^&]*)/.exec(denied.get("OptanonConsent") ?? "")?.[1] ?? "",
    );
    expect(groups).toBe("C0001:1,C0002:0,C0003:0,C0004:0,C0005:0");
    expect(denied.get("OptanonAlertBoxClosed")).toBe(
      "2026-01-15T12:00:00.000Z",
    );

    const accepted = byName(consentWritesFor("accept_all", ctx));
    const acceptedGroups = decodeURIComponent(
      /groups=([^&]*)/.exec(accepted.get("OptanonConsent") ?? "")?.[1] ?? "",
    );
    expect(acceptedGroups).toBe("C0001:1,C0002:1,C0003:1,C0004:1,C0005:1");
  });

  it("OneTrust marks GPC only when the preference sends it", () => {
    const decode = (p: Parameters<typeof consentWritesFor>[0]) =>
      byName(consentWritesFor(p, ctx)).get("OptanonConsent");
    expect(decode("necessary_only")).toContain("isGpcEnabled=1");
    expect(decode("accept_all")).toContain("isGpcEnabled=0");
  });

  it("CookieYes: necessary always yes, categories follow the preference", () => {
    const value = byName(consentWritesFor("necessary_only", ctx)).get(
      "cookieyes-consent",
    );
    expect(value).toBe(
      "consentid:abc123,consent:no,action:yes,necessary:yes,functional:no," +
        "analytics:no,performance:no,advertisement:no,other:no",
    );
    expect(
      byName(consentWritesFor("accept_all", ctx)).get("cookieyes-consent"),
    ).toContain("advertisement:yes");
  });

  it("does not write the generic Cookiebot key unless Cookiebot was detected", () => {
    expect(byName(consentWritesFor("deny_all", ctx)).has("CookieConsent")).toBe(
      false,
    );

    const learned = byName(consentWritesFor("deny_all", ctx, ["cookiebot"]));
    const value = decodeURIComponent(learned.get("CookieConsent") ?? "");
    expect(value).toBe(
      "{stamp:'-1',necessary:true,preferences:false,statistics:false," +
        `marketing:false,method:'explicit',ver:1,utc:${ctx.now}}`,
    );
  });
});

describe("applyConsentWrites", () => {
  const writes = consentWritesFor("deny_all", ctx);

  it("writes every cookie plus the marker on a clean jar", () => {
    const jar = fakeJar();
    applyConsentWrites(writes, "deny_all", jar, true);
    expect(readCookie(jar, "OptanonConsent")).not.toBeNull();
    expect(readCookie(jar, "cookieyes-consent")).not.toBeNull();
    expect(readCookie(jar, MARKER_COOKIE)).toBe("deny_all");
  });

  it("never overwrites a choice the user or the CMP already made", () => {
    const jar = fakeJar("OptanonConsent=theirs");
    applyConsentWrites(writes, "deny_all", jar, true);
    expect(readCookie(jar, "OptanonConsent")).toBe("theirs");
    // …but still fills in the keys that were absent.
    expect(readCookie(jar, "cookieyes-consent")).not.toBeNull();
  });

  it("re-applies when the saved preference differs from what we last wrote", () => {
    const jar = fakeJar();
    applyConsentWrites(writes, "deny_all", jar, true);
    const before = readCookie(jar, "cookieyes-consent");

    applyConsentWrites(
      consentWritesFor("accept_all", ctx),
      "accept_all",
      jar,
      true,
    );
    expect(readCookie(jar, "cookieyes-consent")).not.toBe(before);
    expect(readCookie(jar, "cookieyes-consent")).toContain("advertisement:yes");
    expect(readCookie(jar, MARKER_COOKIE)).toBe("accept_all");
  });

  it("is idempotent when nothing changed", () => {
    const jar = fakeJar();
    applyConsentWrites(writes, "deny_all", jar, true);
    const snapshot = jar.get();
    applyConsentWrites(writes, "deny_all", jar, true);
    expect(jar.get()).toBe(snapshot);
  });
});

describe("learned CMPs", () => {
  it("remembers detected CMPs per origin and tolerates blocked storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;

    learnCmp(storage, "cookiebot");
    learnCmp(storage, "cookiebot");
    learnCmp(storage, "onetrust");
    expect(readLearnedCmps(storage)).toEqual(["cookiebot", "onetrust"]);

    const blocked = {
      getItem() {
        throw new DOMException("denied", "SecurityError");
      },
    };
    expect(readLearnedCmps(blocked)).toEqual([]);
  });
});

describe("settings", () => {
  it("defaults to manual and rejects garbage", () => {
    expect(parseCookieSettings(undefined).mode).toBe("manual");
    expect(
      parseCookieSettings({ mode: "automatic", preference: "nope" }),
    ).toEqual({
      mode: "automatic",
      preference: "necessary_only",
    });
    expect(parseCookieSettings({ mode: "yolo" }).mode).toBe("manual");
  });

  it("sends GPC for every preference except accept_all", () => {
    expect(shouldSendGpc("deny_all")).toBe(true);
    expect(shouldSendGpc("necessary_only")).toBe(true);
    expect(shouldSendGpc("accept_all")).toBe(false);
  });
});
