/**
 * Cookie-consent automation settings, persisted to chrome.storage.local under
 * COOKIE_SETTINGS_STORAGE_KEY. Shared between the settings page (writes it),
 * the background worker (registers/unregisters the injected scripts from it)
 * and the in-page engine (which only needs the preference).
 *
 * Deliberately separate from src/shared/{types,messages}.ts — this feature
 * talks through storage, not the popup<->background message contract.
 */

export const COOKIE_SETTINGS_STORAGE_KEY = "cookieSettings";

/** "manual" = the feature is off and changes nothing. */
export type CookieMode = "manual" | "automatic";

export type CookiePreference = "deny_all" | "necessary_only" | "accept_all";

export interface CookieSettings {
  mode: CookieMode;
  preference: CookiePreference;
}

export const COOKIE_PREFERENCES: readonly CookiePreference[] = [
  "deny_all",
  "necessary_only",
  "accept_all",
];

export const DEFAULT_COOKIE_SETTINGS: CookieSettings = {
  mode: "manual",
  preference: "necessary_only",
};

/** Dropdown labels on the settings page. */
export const COOKIE_PREFERENCE_LABELS: Record<CookiePreference, string> = {
  deny_all: "Deny all by default",
  necessary_only: "Only necessary",
  accept_all: "Accept all",
};

/** Verb phrase for the "we tried to ___ the cookies" apology message. */
export const COOKIE_PREFERENCE_ACTIONS: Record<CookiePreference, string> = {
  deny_all: "deny all",
  necessary_only: "accept only the necessary",
  accept_all: "accept all",
};

/**
 * Optional permissions requested at runtime, from a user gesture on the
 * settings page, only when the user switches to "automatic". Nothing here is
 * in the install-time manifest, so manual mode (the default) adds no
 * permission warnings and updating from an older build never disables the
 * extension pending re-approval.
 */
export const COOKIE_OPTIONAL_PERMISSIONS = [
  "scripting",
  "declarativeNetRequestWithHostAccess",
] as const;
export const COOKIE_HOST_MATCHES = ["http://*/*", "https://*/*"] as const;

export function parseCookieSettings(raw: unknown): CookieSettings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_COOKIE_SETTINGS;
  const { mode, preference } = raw as Record<string, unknown>;
  return {
    mode: mode === "automatic" ? "automatic" : "manual",
    preference: COOKIE_PREFERENCES.includes(preference as CookiePreference)
      ? (preference as CookiePreference)
      : DEFAULT_COOKIE_SETTINGS.preference,
  };
}

/**
 * Global Privacy Control means "don't sell/share my data", so it is sent for
 * every preference except accept-all, where it would contradict the choice.
 */
export function shouldSendGpc(preference: CookiePreference): boolean {
  return preference !== "accept_all";
}
