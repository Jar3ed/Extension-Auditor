// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCookieEngine, type EngineHandle } from "./engine";
import type { CookiePreference } from "./preferences";

/** Fast timings so a "give up" scenario takes ~hundreds of ms, not seconds. */
const FAST = {
  budgetMs: 250,
  noActionMs: 120,
  observeMs: 600,
  pollMs: 15,
  actionGapMs: 10,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(predicate: () => boolean, timeoutMs = 1500) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting");
    await sleep(10);
  }
}

let engine: EngineHandle | undefined;

function start(preference: CookiePreference) {
  engine = runCookieEngine(preference, document, FAST);
  return engine;
}

function isHidden(el: HTMLElement): boolean {
  return el.style.getPropertyValue("visibility") === "hidden";
}

const toast = () => document.getElementById("extsentinel-cookie-toast");

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  // The toast lives on <html>, outside body — don't let one test's leak into the next.
  toast()?.remove();
  document.documentElement.removeAttribute("data-extsentinel-prehide");
  for (const part of document.cookie.split("; ")) {
    const name = part.split("=")[0];
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  }
  localStorage.clear();
});

afterEach(() => {
  engine?.stop();
  engine = undefined;
});

/** A home-made banner no CMP signature would recognise. */
function homemadeBanner(buttons: string[], extraText = "") {
  const banner = document.createElement("div");
  banner.id = "my-notice";
  banner.style.position = "fixed";
  banner.innerHTML =
    `<p>We use cookies to improve your experience. ${extraText}</p>` +
    buttons.map((label) => `<button>${label}</button>`).join("");
  document.body.appendChild(banner);
  const clicks: string[] = [];
  banner.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      clicks.push(button.textContent ?? "");
      banner.remove(); // a real banner dismisses itself after a choice
    });
  });
  return { banner, clicks };
}

describe("semantic fallback on a home-made banner", () => {
  it.each([
    ["deny_all", "Reject all"],
    ["necessary_only", "Only necessary"],
    ["accept_all", "Accept all"],
  ] as const)(
    "%s clicks %j and nothing else",
    async (preference, expectedClick) => {
      const { clicks } = homemadeBanner([
        "Accept all",
        "Only necessary",
        "Reject all",
        "Manage preferences",
      ]);
      start(preference);

      await until(() => clicks.length > 0);
      expect(clicks).toEqual([expectedClick]);
      expect(toast()).toBeNull();
    },
  );

  it("works for a banner injected after the engine started", async () => {
    start("deny_all");
    await sleep(40);
    const { clicks } = homemadeBanner(["Accept", "Decline"]);

    await until(() => clicks.length > 0);
    expect(clicks).toEqual(["Decline"]);
  });

  it("hides the banner from the moment it is detected", async () => {
    const { banner } = homemadeBanner(["Accept", "Reject"]);
    // A banner that ignores clicks, so it stays around to be inspected.
    banner.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", (e) => e.stopImmediatePropagation(), true);
    });
    start("deny_all");

    await until(() => isHidden(banner));
    expect(banner.style.getPropertyPriority("visibility")).toBe("important");
    expect(banner.style.getPropertyValue("pointer-events")).toBe("none");
  });

  it("understands other languages", async () => {
    const { clicks } = homemadeBanner(
      ["Alle akzeptieren", "Alle ablehnen"],
      "Wir verwenden Cookies.",
    );
    start("deny_all");
    await until(() => clicks.length > 0);
    expect(clicks).toEqual(["Alle ablehnen"]);
  });
});

describe("last resort: restore the banner and apologise", () => {
  it("restores the banner and shows the apology when no control fits", async () => {
    // Only an "Accept" button, but the user wants everything denied.
    const { banner, clicks } = homemadeBanner(["Accept all"]);
    start("deny_all");

    await until(() => toast() !== null);
    expect(clicks).toEqual([]); // never accepted against the user's wishes
    expect(banner.isConnected).toBe(true);
    expect(isHidden(banner)).toBe(false);
    expect(banner.style.getPropertyValue("pointer-events")).toBe("");
    expect(toast()?.shadowRoot?.textContent).toContain("deny all");
    expect(toast()?.shadowRoot?.textContent).toContain("unable");
  });

  it("restores and apologises when the click has no effect", async () => {
    const { banner } = homemadeBanner(["Accept", "Reject all"]);
    // Rewire: the banner swallows every click and never goes away.
    banner.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", (e) => e.stopImmediatePropagation(), true);
    });
    start("necessary_only");

    await until(() => toast() !== null);
    expect(isHidden(banner)).toBe(false);
    expect(toast()?.shadowRoot?.textContent).toContain(
      "accept only the necessary",
    );
  });

  it("names the right action for accept_all", async () => {
    const { banner } = homemadeBanner(["Reject all"]);
    start("accept_all");
    await until(() => toast() !== null);
    expect(banner.isConnected).toBe(true);
    expect(toast()?.shadowRoot?.textContent).toContain("accept all");
  });

  it("shows the apology only once", async () => {
    homemadeBanner(["Accept all"]);
    start("deny_all");
    await until(() => toast() !== null);
    await sleep(100);
    expect(document.querySelectorAll("#extsentinel-cookie-toast")).toHaveLength(
      1,
    );
  });
});

describe("known CMP signatures", () => {
  function oneTrustPage() {
    document.body.innerHTML = `
      <div id="onetrust-consent-sdk">
        <div id="onetrust-banner-sdk" style="position:fixed">
          <p>This site uses cookies</p>
          <button id="onetrust-accept-btn-handler">Accept All</button>
          <button id="onetrust-reject-all-handler">Reject All</button>
          <button id="onetrust-pc-btn-handler">Cookies Settings</button>
        </div>
      </div>`;
    const clicks: string[] = [];
    document.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        clicks.push(b.id);
        document
          .getElementById("onetrust-banner-sdk")
          ?.style.setProperty("display", "none");
      }),
    );
    return clicks;
  }

  it("clicks the CMP's own reject button for deny_all and necessary_only", async () => {
    for (const preference of ["deny_all", "necessary_only"] as const) {
      document.body.innerHTML = "";
      const clicks = oneTrustPage();
      const handle = start(preference);
      await until(() => clicks.length > 0);
      expect(clicks).toEqual(["onetrust-reject-all-handler"]);
      handle.stop();
    }
  });

  it("clicks accept for accept_all", async () => {
    const clicks = oneTrustPage();
    start("accept_all");
    await until(() => clicks.length > 0);
    expect(clicks).toEqual(["onetrust-accept-btn-handler"]);
  });

  it("does NOT apologise for a CMP container that stays in the DOM after consent", async () => {
    // OneTrust keeps #onetrust-consent-sdk forever; only the banner inside
    // is display:none. That is a resolved banner, not a failure.
    document.body.innerHTML = `
      <div id="onetrust-consent-sdk">
        <div id="onetrust-banner-sdk" style="display:none">
          <button id="onetrust-accept-btn-handler">Accept All</button>
          <button id="onetrust-reject-all-handler">Reject All</button>
        </div>
        <button id="ot-sdk-btn-floating">Cookie settings</button>
      </div>`;
    start("deny_all");

    await sleep(FAST.budgetMs + 150);
    expect(toast()).toBeNull();
    const container = document.getElementById("onetrust-consent-sdk");
    expect(container?.style.getPropertyValue("visibility")).not.toBe("hidden");
  });

  it("opens the settings layer, then rejects, when there is no first-layer reject", async () => {
    document.body.innerHTML = `
      <div id="didomi-host">
        <div id="layer1" style="position:fixed">
          <p>We value your privacy and use cookies.</p>
          <button id="didomi-notice-agree-button">Agree</button>
          <button id="didomi-notice-learn-more-button">Learn more</button>
        </div>
        <div id="layer2" style="display:none; position:fixed">
          <button id="didomi-notice-disagree-button">Disagree</button>
        </div>
      </div>`;
    const clicks: string[] = [];
    document
      .getElementById("didomi-notice-learn-more-button")
      ?.addEventListener("click", () => {
        clicks.push("settings");
        document.getElementById("layer1")?.style.setProperty("display", "none");
        document
          .getElementById("layer2")
          ?.style.setProperty("display", "block");
      });
    document
      .getElementById("didomi-notice-disagree-button")
      ?.addEventListener("click", () => {
        clicks.push("disagree");
        document.getElementById("layer2")?.style.setProperty("display", "none");
      });

    start("deny_all");
    await until(() => clicks.includes("disagree"));
    expect(clicks).toEqual(["settings", "disagree"]);
    expect(toast()).toBeNull();
  });
});

describe("shadow DOM banners", () => {
  it("finds and clicks controls inside an open shadow root", async () => {
    const host = document.createElement("div");
    host.id = "usercentrics-root";
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <div style="position:fixed">
        <p>Cookies</p>
        <button data-testid="uc-accept-all-button">Accept All</button>
        <button data-testid="uc-deny-all-button">Deny</button>
      </div>`;
    const clicks: string[] = [];
    shadow
      .querySelectorAll("button")
      .forEach((b) =>
        b.addEventListener("click", () => clicks.push(b.dataset.testid ?? "")),
      );
    start("deny_all");

    await until(() => clicks.length > 0);
    expect(clicks).toEqual(["uc-deny-all-button"]);
  });
});

describe("safety", () => {
  it("never clicks links that would navigate away", async () => {
    const banner = document.createElement("div");
    banner.style.position = "fixed";
    banner.innerHTML = `<p>We use cookies.</p><a id="nav" href="https://example.com/cookie-policy">Reject</a>`;
    document.body.appendChild(banner);
    let clicked = false;
    banner
      .querySelector("a")
      ?.addEventListener("click", () => (clicked = true));

    start("deny_all");
    await sleep(100);
    expect(clicked).toBe(false);
  });

  it("ignores cookie-looking text that isn't in a banner box", async () => {
    document.body.innerHTML = `
      <article><h1>How cookies work</h1>
      <p>Read about cookies and consent.</p>
      <button id="b">Accept</button></article>`;
    let clicked = false;
    document
      .getElementById("b")
      ?.addEventListener("click", () => (clicked = true));

    start("accept_all");
    await sleep(120);
    expect(clicked).toBe(false);
    expect(toast()).toBeNull();
  });

  it("leaves a normal page with no banner completely untouched", async () => {
    document.body.innerHTML = `<main><h1>Hello</h1><button>Save</button></main>`;
    const html = document.body.innerHTML;
    start("deny_all");
    await sleep(FAST.observeMs + 150);

    expect(document.body.innerHTML).toBe(html);
    expect(
      document.documentElement.hasAttribute("data-extsentinel-prehide"),
    ).toBe(false);
    expect(toast()).toBeNull();
  });
});

describe("invisible layer: consent keys written at start", () => {
  it("writes the CMP dictionary before any banner exists", () => {
    start("deny_all");
    expect(document.cookie).toContain("OptanonConsent=");
    expect(document.cookie).toContain("cookieyes-consent=");
    expect(document.cookie).toContain("__extsentinel_cc=deny_all");
    expect(document.cookie).not.toContain("CookieConsent=");
  });

  it("writes the Cookiebot key once Cookiebot has been seen on this origin", async () => {
    document.body.innerHTML = `<div id="CybotCookiebotDialog" style="display:none"></div>`;
    const first = start("deny_all");
    await sleep(60); // let a scan notice Cookiebot
    first.stop();
    expect(localStorage.getItem("__extsentinel_cmp")).toBe("cookiebot");

    document.cookie = "__extsentinel_cc=; max-age=0; path=/";
    start("deny_all");
    expect(document.cookie).toContain("CookieConsent=");
  });

  it("pre-hides known containers before the page can paint them", () => {
    start("deny_all");
    expect(
      document.documentElement.hasAttribute("data-extsentinel-prehide"),
    ).toBe(true);
    expect(
      document.getElementById("extsentinel-cookie-style")?.textContent,
    ).toContain("#onetrust-consent-sdk");
  });
});
