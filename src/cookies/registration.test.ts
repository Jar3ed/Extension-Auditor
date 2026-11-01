import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildContentScripts,
  buildGpcRule,
  ENGINE_SCRIPT_FILES,
  ENGINE_SCRIPT_ID,
  GPC_RULE_ID,
  GPC_SCRIPT_ID,
  syncCookieAutomation,
} from "./registration";

interface FakeChrome {
  registered: Map<string, { id: string }>;
  rules: Map<number, unknown>;
  granted: boolean;
  log: string[];
}

function installChrome(options: { granted: boolean; withApis?: boolean }) {
  const state: FakeChrome = {
    registered: new Map(),
    rules: new Map(),
    granted: options.granted,
    log: [],
  };
  const scripting = {
    getRegisteredContentScripts: vi.fn(async ({ ids }: { ids: string[] }) =>
      ids.flatMap((id) => (state.registered.has(id) ? [{ id }] : [])),
    ),
    unregisterContentScripts: vi.fn(async ({ ids }: { ids: string[] }) => {
      for (const id of ids) {
        if (!state.registered.has(id)) throw new Error(`Nonexistent id ${id}`);
        state.registered.delete(id);
        state.log.push(`unregister:${id}`);
      }
    }),
    registerContentScripts: vi.fn(async (scripts: { id: string }[]) => {
      // Real Chrome rejects the whole call on a duplicate id.
      await Promise.resolve();
      for (const s of scripts) {
        if (state.registered.has(s.id)) {
          throw new Error(`Duplicate script ID '${s.id}'`);
        }
      }
      for (const s of scripts) {
        state.registered.set(s.id, s);
        state.log.push(`register:${s.id}`);
      }
    }),
  };
  const declarativeNetRequest = {
    updateDynamicRules: vi.fn(
      async (u: { removeRuleIds?: number[]; addRules?: { id: number }[] }) => {
        u.removeRuleIds?.forEach((id) => state.rules.delete(id));
        u.addRules?.forEach((r) => state.rules.set(r.id, r));
      },
    ),
  };
  vi.stubGlobal("chrome", {
    permissions: { contains: vi.fn(async () => state.granted) },
    // Optional-permission namespaces are absent until the user grants them.
    ...(options.withApis === false ? {} : { scripting, declarativeNetRequest }),
  });
  return state;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildContentScripts", () => {
  it("registers the preference-specific engine at document_start in all frames", () => {
    const [engine] = buildContentScripts("deny_all");
    expect(engine).toMatchObject({
      id: ENGINE_SCRIPT_ID,
      js: [ENGINE_SCRIPT_FILES.deny_all],
      runAt: "document_start",
      allFrames: true,
      persistAcrossSessions: true,
    });
    expect(engine?.matches).toEqual(["http://*/*", "https://*/*"]);
  });

  it("adds the MAIN-world GPC script for deny/necessary but not accept_all", () => {
    for (const preference of ["deny_all", "necessary_only"] as const) {
      const scripts = buildContentScripts(preference);
      expect(scripts.map((s) => s.id)).toEqual([
        ENGINE_SCRIPT_ID,
        GPC_SCRIPT_ID,
      ]);
      expect(scripts[1]?.world).toBe("MAIN");
    }
    expect(buildContentScripts("accept_all").map((s) => s.id)).toEqual([
      ENGINE_SCRIPT_ID,
    ]);
  });
});

describe("buildGpcRule", () => {
  it("sets Sec-GPC: 1 on requests including top-level navigations", () => {
    const rule = buildGpcRule();
    expect(rule.id).toBe(GPC_RULE_ID);
    expect(rule.action.requestHeaders).toEqual([
      { header: "Sec-GPC", operation: "set", value: "1" },
    ]);
    // main_frame is excluded by Chrome unless named explicitly.
    expect(rule.condition.resourceTypes).toContain("main_frame");
    expect(rule.condition.resourceTypes).toContain("xmlhttprequest");
  });
});

describe("syncCookieAutomation", () => {
  beforeEach(() => vi.useRealTimers());

  it("manual mode registers nothing and removes anything left behind", async () => {
    const state = installChrome({ granted: true });
    state.registered.set(ENGINE_SCRIPT_ID, { id: ENGINE_SCRIPT_ID });
    state.rules.set(GPC_RULE_ID, {});

    await syncCookieAutomation({ mode: "manual", preference: "deny_all" });

    expect(state.registered.size).toBe(0);
    expect(state.rules.size).toBe(0);
  });

  it("automatic + granted registers scripts and the GPC rule", async () => {
    const state = installChrome({ granted: true });
    await syncCookieAutomation({ mode: "automatic", preference: "deny_all" });

    expect([...state.registered.keys()].sort()).toEqual(
      [ENGINE_SCRIPT_ID, GPC_SCRIPT_ID].sort(),
    );
    expect(state.rules.has(GPC_RULE_ID)).toBe(true);
  });

  it("accept_all registers the engine but no GPC script or rule", async () => {
    const state = installChrome({ granted: true });
    await syncCookieAutomation({ mode: "automatic", preference: "accept_all" });

    expect([...state.registered.keys()]).toEqual([ENGINE_SCRIPT_ID]);
    expect(state.rules.size).toBe(0);
  });

  it("switching preference swaps the engine file and drops stale GPC state", async () => {
    const state = installChrome({ granted: true });
    await syncCookieAutomation({ mode: "automatic", preference: "deny_all" });
    await syncCookieAutomation({ mode: "automatic", preference: "accept_all" });

    expect([...state.registered.keys()]).toEqual([ENGINE_SCRIPT_ID]);
    expect(
      (state.registered.get(ENGINE_SCRIPT_ID) as unknown as { js: string[] })
        .js,
    ).toEqual([ENGINE_SCRIPT_FILES.accept_all]);
    expect(state.rules.size).toBe(0);
  });

  it("automatic without the permissions behaves like manual", async () => {
    const state = installChrome({ granted: false });
    await syncCookieAutomation({ mode: "automatic", preference: "deny_all" });
    expect(state.registered.size).toBe(0);
    expect(state.rules.size).toBe(0);
  });

  it("copes with the optional API namespaces not existing yet", async () => {
    installChrome({ granted: false, withApis: false });
    await expect(
      syncCookieAutomation({ mode: "manual", preference: "deny_all" }),
    ).resolves.toBeUndefined();
  });

  it("overlapping syncs never hit 'Duplicate script ID'", async () => {
    const state = installChrome({ granted: true });
    const results = await Promise.allSettled([
      syncCookieAutomation({ mode: "automatic", preference: "deny_all" }),
      syncCookieAutomation({ mode: "automatic", preference: "necessary_only" }),
      syncCookieAutomation({ mode: "automatic", preference: "accept_all" }),
    ]);

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    // Last writer wins.
    expect(
      (state.registered.get(ENGINE_SCRIPT_ID) as unknown as { js: string[] })
        .js,
    ).toEqual([ENGINE_SCRIPT_FILES.accept_all]);
  });

  it("a failed sync doesn't wedge the queue", async () => {
    const state = installChrome({ granted: true });
    const scripting = (globalThis as unknown as { chrome: typeof chrome })
      .chrome.scripting;
    vi.spyOn(scripting, "registerContentScripts").mockRejectedValueOnce(
      new Error("boom"),
    );

    await expect(
      syncCookieAutomation({ mode: "automatic", preference: "deny_all" }),
    ).rejects.toThrow("boom");
    await syncCookieAutomation({ mode: "automatic", preference: "deny_all" });
    expect(state.registered.has(ENGINE_SCRIPT_ID)).toBe(true);
  });
});
