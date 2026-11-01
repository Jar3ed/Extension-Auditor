/**
 * Cookie preferences page. "Manual" (the default) does nothing at all;
 * "Automatic" applies the chosen preference to cookie banners on every site
 * (see src/cookies/ for how). Settings persist to chrome.storage.local and
 * the background worker registers/unregisters everything in response.
 *
 * Switching to Automatic requests the extra permissions it needs, from the
 * click itself (Chrome requires a user gesture); switching back to Manual
 * hands them back.
 */

import { useCallback, useEffect, useState } from "react";
import {
  COOKIE_HOST_MATCHES,
  COOKIE_OPTIONAL_PERMISSIONS,
  COOKIE_PREFERENCES,
  COOKIE_PREFERENCE_LABELS,
  COOKIE_SETTINGS_STORAGE_KEY,
  DEFAULT_COOKIE_SETTINGS,
  parseCookieSettings,
  type CookiePreference,
  type CookieSettings,
} from "../../src/cookies/preferences";
import { hasCookiePermissions } from "../../src/cookies/registration";

const PREFERENCE_HELP: Record<CookiePreference, string> = {
  deny_all:
    "Declines every optional cookie category and signals Global Privacy Control. Sites may still set cookies they consider strictly necessary to run.",
  necessary_only:
    "Accepts only the cookies a site needs to work and rejects the rest. Also signals Global Privacy Control.",
  accept_all:
    "Accepts all cookies so banners go away. Global Privacy Control is not sent.",
};

const PERMISSION_REQUEST = {
  permissions: [...COOKIE_OPTIONAL_PERMISSIONS],
  origins: [...COOKIE_HOST_MATCHES],
};

export default function App() {
  // null while the stored values are still loading.
  const [settings, setSettings] = useState<CookieSettings | null>(null);
  const [permitted, setPermitted] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshPermission = useCallback(async () => {
    setPermitted(await hasCookiePermissions());
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const stored = await chrome.storage.local.get(
        COOKIE_SETTINGS_STORAGE_KEY,
      );
      if (!ignore) {
        setSettings(parseCookieSettings(stored[COOKIE_SETTINGS_STORAGE_KEY]));
      }
    })();
    (async () => {
      const ok = await hasCookiePermissions();
      if (!ignore) setPermitted(ok);
    })();

    // Permissions can also change from chrome://extensions.
    chrome.permissions.onAdded.addListener(refreshPermission);
    chrome.permissions.onRemoved.addListener(refreshPermission);
    return () => {
      ignore = true;
      chrome.permissions.onAdded.removeListener(refreshPermission);
      chrome.permissions.onRemoved.removeListener(refreshPermission);
    };
  }, [refreshPermission]);

  const current = settings ?? DEFAULT_COOKIE_SETTINGS;
  const automatic = current.mode === "automatic";

  async function save(next: CookieSettings) {
    setSettings(next);
    await chrome.storage.local.set({ [COOKIE_SETTINGS_STORAGE_KEY]: next });
  }

  async function enableAutomatic() {
    setNotice(null);
    // Must be the first await: the user-gesture window closes after it.
    const granted = await chrome.permissions.request(PERMISSION_REQUEST);
    if (!granted) {
      setNotice(
        "Permission wasn't granted, so cookie handling is still manual.",
      );
      return;
    }
    await save({ ...current, mode: "automatic" });
    await refreshPermission();
  }

  async function disableAutomatic() {
    setNotice(null);
    await save({ ...current, mode: "manual" });
    try {
      await chrome.permissions.remove(PERMISSION_REQUEST);
    } catch {
      // Already gone — nothing to give back.
    }
  }

  const needsPermission = automatic && permitted === false;

  return (
    <div className="mx-auto max-w-md p-6 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <h1 className="text-lg font-semibold">Cookie preferences</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Choose how ExtSentinel deals with cookie banners on the websites you
        visit.
      </p>

      <fieldset className="mt-6 space-y-3" disabled={settings === null}>
        <legend className="sr-only">Cookie banner handling</legend>

        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="mode"
            className="mt-0.5"
            checked={!automatic}
            onChange={() => void disableAutomatic()}
          />
          <span>
            <span className="font-medium">I&apos;ll choose myself</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Default. ExtSentinel changes nothing and asks for no extra
              permissions.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="mode"
            className="mt-0.5"
            checked={automatic}
            onChange={() => void enableAutomatic()}
          />
          <span>
            <span className="font-medium">Set my preference automatically</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Applied to cookie banners on future website visits.
            </span>
          </span>
        </label>
      </fieldset>

      {automatic && (
        <div className="mt-5 ml-6">
          <label
            htmlFor="cookie-preference"
            className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Default choice
          </label>
          <select
            id="cookie-preference"
            value={current.preference}
            onChange={(e) =>
              void save({
                ...current,
                preference: e.target.value as CookiePreference,
              })
            }
            className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {COOKIE_PREFERENCES.map((preference) => (
              <option key={preference} value={preference}>
                {COOKIE_PREFERENCE_LABELS[preference]}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {PREFERENCE_HELP[current.preference]}
          </p>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Some banners can&apos;t be handled automatically. When that happens
            the banner is shown again with a short message, so you can choose
            yourself.
          </p>
        </div>
      )}

      {needsPermission && (
        <div
          role="alert"
          className="mt-5 rounded border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200"
        >
          <p>
            Automatic handling is on, but ExtSentinel no longer has the
            permissions it needs (they may have been revoked in
            chrome://extensions), so nothing is being applied.
          </p>
          <button
            type="button"
            className="mt-2 rounded bg-amber-600 px-2 py-1 font-medium text-white hover:bg-amber-700"
            onClick={() => void enableAutomatic()}
          >
            Grant permissions again
          </button>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="mt-5 text-xs text-red-600 dark:text-red-400"
        >
          {notice}
        </p>
      )}

      <p className="mt-8 text-xs text-slate-500 dark:text-slate-400">
        Automatic mode asks Chrome for access to all websites so it can handle
        banners as pages load. Choosing &ldquo;I&apos;ll choose myself&rdquo;
        again turns it off and gives that access back.
      </p>
    </div>
  );
}
