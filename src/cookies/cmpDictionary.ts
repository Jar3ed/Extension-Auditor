/**
 * Dictionary of the consent keys major consent-management platforms (CMPs)
 * read on page load. Written before the site's own scripts run (document_start)
 * so the CMP sees a stored choice and never shows its banner.
 *
 * Formats are limited to ones documented by the vendors/their ecosystem
 * (OneTrust `groups=C000x:0|1`, Cookiebot's `CookieConsent` object, CookieYes'
 * `key:yes|no` list). Anything we can't generate faithfully — e.g. IAB TCF
 * `euconsent-v2` strings, Didomi tokens, Klaro's per-site service names — is
 * deliberately absent: the DOM fallback in engine.ts handles those CMPs.
 *
 * A wrong or stale value is harmless-by-design: the CMP just re-shows its
 * banner and the DOM fallback takes over.
 */

import type { CookiePreference } from "./preferences";

export type ConsentWrite =
  | { kind: "cookie"; name: string; value: string; maxAgeSeconds: number }
  | { kind: "localStorage"; key: string; value: string };

export interface WriteContext {
  now: number;
  /** Random id for CMPs that log a consent id; injectable for tests. */
  randomId: string;
}

export interface CmpDefinition {
  id: string;
  /**
   * The cookie name is generic enough that other (custom) banners use it for
   * a different format — e.g. Salesforce also uses `CookieConsent`. Written
   * only on origins where this CMP has actually been detected before.
   */
  collisionProne: boolean;
  build(preference: CookiePreference, ctx: WriteContext): ConsentWrite[];
}

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

const optIn = (preference: CookiePreference) => preference === "accept_all";

const oneTrust: CmpDefinition = {
  id: "onetrust",
  collisionProne: false,
  build(preference, { now }) {
    const on = optIn(preference) ? 1 : 0;
    // C0001 (strictly necessary) is always on in OneTrust; C0002-C0005 are
    // performance, functional, targeting and social-media.
    const groups = `C0001:1,C0002:${on},C0003:${on},C0004:${on},C0005:${on}`;
    const consent = [
      `isGpcEnabled=${preference === "accept_all" ? 0 : 1}`,
      `datestamp=${encodeURIComponent(new Date(now).toString())}`,
      "version=202401.1.0",
      "isIABGlobal=false",
      "hosts=",
      "interactionCount=1",
      "landingPath=NotLandingPage",
      `groups=${encodeURIComponent(groups)}`,
    ].join("&");
    return [
      {
        kind: "cookie",
        name: "OptanonAlertBoxClosed",
        value: new Date(now).toISOString(),
        maxAgeSeconds: ONE_YEAR_SECONDS,
      },
      {
        kind: "cookie",
        name: "OptanonConsent",
        value: consent,
        maxAgeSeconds: ONE_YEAR_SECONDS,
      },
    ];
  },
};

const cookiebot: CmpDefinition = {
  id: "cookiebot",
  collisionProne: true,
  build(preference, { now }) {
    const on = optIn(preference);
    const value =
      `{stamp:'-1',necessary:true,preferences:${on},statistics:${on},` +
      `marketing:${on},method:'explicit',ver:1,utc:${now}}`;
    return [
      {
        kind: "cookie",
        name: "CookieConsent",
        value: encodeURIComponent(value),
        maxAgeSeconds: ONE_YEAR_SECONDS,
      },
    ];
  },
};

const cookieYes: CmpDefinition = {
  id: "cookieyes",
  collisionProne: false,
  build(preference, { randomId }) {
    const yn = optIn(preference) ? "yes" : "no";
    const value = [
      `consentid:${randomId}`,
      `consent:${yn}`,
      "action:yes",
      "necessary:yes",
      `functional:${yn}`,
      `analytics:${yn}`,
      `performance:${yn}`,
      `advertisement:${yn}`,
      `other:${yn}`,
    ].join(",");
    return [
      {
        kind: "cookie",
        name: "cookieyes-consent",
        value,
        maxAgeSeconds: ONE_YEAR_SECONDS,
      },
    ];
  },
};

export const CMP_DICTIONARY: readonly CmpDefinition[] = [
  oneTrust,
  cookiebot,
  cookieYes,
];

/**
 * Writes to perform for a page load. Collision-prone CMPs are only included
 * when `learnedCmpIds` says this origin was seen using them.
 */
export function consentWritesFor(
  preference: CookiePreference,
  ctx: WriteContext,
  learnedCmpIds: readonly string[] = [],
): ConsentWrite[] {
  return CMP_DICTIONARY.filter(
    (cmp) => !cmp.collisionProne || learnedCmpIds.includes(cmp.id),
  ).flatMap((cmp) => cmp.build(preference, ctx));
}
