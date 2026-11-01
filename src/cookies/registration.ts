/**
 * Background-side plumbing: turns CookieSettings into registered content
 * scripts + a Sec-GPC header rule, and tears them all down in manual mode.
 *
 * Everything here depends on permissions that are only *optional* in the
 * manifest (see preferences.ts), so the chrome.scripting /
 * chrome.declarativeNetRequest namespaces may not exist at all until the
 * user opts in — every access is guarded.
 */

import {
  COOKIE_HOST_MATCHES,
  COOKIE_OPTIONAL_PERMISSIONS,
  shouldSendGpc,
  type CookiePreference,
  type CookieSettings,
} from "./preferences";

export const ENGINE_SCRIPT_ID = "extsentinel-cookie-engine";
export const GPC_SCRIPT_ID = "extsentinel-cookie-gpc";
export const GPC_RULE_ID = 1;

/** Built by WXT from entrypoints/cookie-*.ts (unlisted scripts). */
export const ENGINE_SCRIPT_FILES: Record<CookiePreference, string> = {
  deny_all: "cookie-engine-deny-all.js",
  necessary_only: "cookie-engine-necessary-only.js",
  accept_all: "cookie-engine-accept-all.js",
};
export const GPC_SCRIPT_FILE = "cookie-gpc.js";

export function buildContentScripts(
  preference: CookiePreference,
): chrome.scripting.RegisteredContentScript[] {
  const common = {
    matches: [...COOKIE_HOST_MATCHES],
    runAt: "document_start" as const,
    allFrames: true,
    persistAcrossSessions: true,
  };
  const scripts: chrome.scripting.RegisteredContentScript[] = [
    { id: ENGINE_SCRIPT_ID, js: [ENGINE_SCRIPT_FILES[preference]], ...common },
  ];
  if (shouldSendGpc(preference)) {
    // MAIN world: navigator.globalPrivacyControl is read by the page's own
    // scripts, so it has to be defined where they can see it.
    scripts.push({
      id: GPC_SCRIPT_ID,
      js: [GPC_SCRIPT_FILE],
      world: "MAIN",
      ...common,
    });
  }
  return scripts;
}

export function buildGpcRule(): chrome.declarativeNetRequest.Rule {
  return {
    id: GPC_RULE_ID,
    priority: 1,
    action: {
      type: "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType,
      requestHeaders: [
        {
          header: "Sec-GPC",
          operation: "set" as chrome.declarativeNetRequest.HeaderOperation,
          value: "1",
        },
      ],
    },
    condition: {
      regexFilter: "^https?://",
      // main_frame is excluded unless listed explicitly.
      resourceTypes: [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "other",
      ] as chrome.declarativeNetRequest.ResourceType[],
    },
  };
}

export async function hasCookiePermissions(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({
      permissions: [...COOKIE_OPTIONAL_PERMISSIONS],
      origins: [...COOKIE_HOST_MATCHES],
    });
  } catch {
    return false;
  }
}

async function clearAutomation(): Promise<void> {
  if (chrome.scripting) {
    const existing = await chrome.scripting.getRegisteredContentScripts({
      ids: [ENGINE_SCRIPT_ID, GPC_SCRIPT_ID],
    });
    if (existing.length > 0) {
      await chrome.scripting.unregisterContentScripts({
        ids: existing.map((s) => s.id),
      });
    }
  }
  if (chrome.declarativeNetRequest) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [GPC_RULE_ID],
    });
  }
}

async function applySettings(settings: CookieSettings): Promise<void> {
  const active =
    settings.mode === "automatic" && (await hasCookiePermissions());
  await clearAutomation();
  if (!active) return;

  await chrome.scripting.registerContentScripts(
    buildContentScripts(settings.preference),
  );
  if (shouldSendGpc(settings.preference)) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [GPC_RULE_ID],
      addRules: [buildGpcRule()],
    });
  }
}

let queue: Promise<void> = Promise.resolve();

/**
 * Makes the registered scripts/rules match `settings`. Calls are serialised:
 * two overlapping syncs (rapid dropdown changes) would otherwise race into
 * "Duplicate script ID" errors. A failed sync never blocks the next one.
 */
export function syncCookieAutomation(settings: CookieSettings): Promise<void> {
  const run = queue.then(() => applySettings(settings));
  queue = run.catch(() => undefined);
  return run;
}
