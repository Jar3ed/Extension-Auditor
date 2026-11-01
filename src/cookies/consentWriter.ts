/**
 * Applies the CMP dictionary's consent keys to the page's own storage before
 * the site's scripts run, plus the per-origin memory of which CMPs a site
 * uses (so collision-prone keys are only ever written where they belong).
 */

import { consentWritesFor, type ConsentWrite } from "./cmpDictionary";
import type { CookiePreference } from "./preferences";

/** Records which preference we last wrote, so a changed setting can re-apply. */
export const MARKER_COOKIE = "__extsentinel_cc";
/** Page-origin localStorage key holding the comma-separated detected CMP ids. */
export const LEARNED_CMP_KEY = "__extsentinel_cmp";

export interface CookieJar {
  get(): string;
  set(cookie: string): void;
}

export function readCookie(jar: CookieJar, name: string): string | null {
  for (const part of jar.get().split("; ")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

function cookieString(
  name: string,
  value: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  return `${name}=${value}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}

/**
 * Writes a cookie only when it's absent — so a choice the user (or the CMP)
 * already made is never clobbered — unless our own marker shows the existing
 * value came from a *different* ExtSentinel preference, in which case the
 * setting changed and we re-apply.
 */
export function applyConsentWrites(
  writes: readonly ConsentWrite[],
  preference: CookiePreference,
  jar: CookieJar,
  secure: boolean,
): void {
  const marker = readCookie(jar, MARKER_COOKIE);
  const preferenceChanged = marker !== null && marker !== preference;
  let wrote = false;
  for (const write of writes) {
    if (write.kind !== "cookie") continue;
    const exists = readCookie(jar, write.name) !== null;
    if (exists && !preferenceChanged) continue;
    jar.set(cookieString(write.name, write.value, write.maxAgeSeconds, secure));
    wrote = true;
  }
  if (wrote || preferenceChanged) {
    jar.set(cookieString(MARKER_COOKIE, preference, 365 * 86400, secure));
  }
}

export function readLearnedCmps(storage: Pick<Storage, "getItem">): string[] {
  try {
    return (storage.getItem(LEARNED_CMP_KEY) ?? "").split(",").filter(Boolean);
  } catch {
    return []; // sandboxed frames / blocked storage throw on access
  }
}

export function learnCmp(storage: Storage, cmpId: string): void {
  try {
    const known = readLearnedCmps(storage);
    if (known.includes(cmpId)) return;
    storage.setItem(LEARNED_CMP_KEY, [...known, cmpId].join(","));
  } catch {
    // best-effort memory only
  }
}

export function writeConsentKeys(
  preference: CookiePreference,
  win: Pick<Window, "location" | "localStorage"> & { document: Document },
  now: number,
  randomId: string,
): void {
  const jar: CookieJar = {
    get: () => win.document.cookie,
    set: (cookie) => {
      win.document.cookie = cookie;
    },
  };
  let learned: string[] = [];
  try {
    learned = readLearnedCmps(win.localStorage);
  } catch {
    // inaccessible localStorage — only unconditional keys get written
  }
  const writes = consentWritesFor(preference, { now, randomId }, learned);
  applyConsentWrites(
    writes,
    preference,
    jar,
    win.location.protocol === "https:",
  );
}
