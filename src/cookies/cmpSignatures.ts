/**
 * DOM signatures of known CMP banners: the container to hide immediately
 * (before we know anything else about the page) and the selectors for the
 * controls we care about, keyed by intent.
 *
 * Best-effort: vendors change class names without notice. A stale selector
 * simply stops matching and the semantic text scan in text.ts picks the
 * banner up instead, so nothing here is load-bearing for correctness.
 */

import type { ControlIntent } from "./text";

export interface CmpSignature {
  id: string;
  containers: string[];
  controls: Partial<Record<ControlIntent, string[]>>;
}

export const CMP_SIGNATURES: readonly CmpSignature[] = [
  {
    id: "onetrust",
    containers: ["#onetrust-consent-sdk"],
    controls: {
      reject: ["#onetrust-reject-all-handler", ".ot-pc-refuse-all-handler"],
      necessary: ["#onetrust-reject-all-handler"],
      accept: [
        "#onetrust-accept-btn-handler",
        "#accept-recommended-btn-handler",
      ],
      settings: ["#onetrust-pc-btn-handler"],
      save: [".save-preference-btn-handler"],
    },
  },
  {
    id: "cookiebot",
    containers: ["#CybotCookiebotDialog"],
    controls: {
      reject: ["#CybotCookiebotDialogBodyButtonDecline"],
      necessary: ["#CybotCookiebotDialogBodyButtonDecline"],
      accept: [
        "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
        "#CybotCookiebotDialogBodyButtonAccept",
      ],
    },
  },
  {
    id: "didomi",
    containers: ["#didomi-host"],
    controls: {
      reject: ["#didomi-notice-disagree-button"],
      accept: ["#didomi-notice-agree-button"],
      settings: ["#didomi-notice-learn-more-button"],
    },
  },
  {
    id: "usercentrics",
    containers: ["#usercentrics-root"],
    controls: {
      reject: ['[data-testid="uc-deny-all-button"]'],
      accept: ['[data-testid="uc-accept-all-button"]'],
      settings: ['[data-testid="uc-more-button"]'],
    },
  },
  {
    id: "cookieyes",
    containers: [".cky-consent-container", ".cky-modal"],
    controls: {
      reject: [".cky-btn-reject"],
      accept: [".cky-btn-accept"],
      settings: [".cky-btn-customize"],
      save: [".cky-btn-preferences"],
    },
  },
  {
    id: "complianz",
    containers: [".cmplz-cookiebanner"],
    controls: {
      reject: [".cmplz-deny"],
      accept: [".cmplz-accept"],
      settings: [".cmplz-view-preferences"],
      save: [".cmplz-save-preferences"],
    },
  },
  {
    id: "cookie-notice",
    containers: ["#cookie-notice"],
    controls: {
      reject: ["#cn-refuse-cookie"],
      accept: ["#cn-accept-cookie"],
    },
  },
  {
    id: "osano",
    containers: [".osano-cm-window"],
    controls: {
      reject: [".osano-cm-deny"],
      accept: [".osano-cm-accept-all"],
    },
  },
  {
    id: "iubenda",
    containers: ["#iubenda-cs-banner"],
    controls: {
      reject: [".iubenda-cs-reject-btn"],
      accept: [".iubenda-cs-accept-btn"],
      settings: [".iubenda-cs-customize-btn"],
    },
  },
  {
    id: "termly",
    containers: ["#termly-code-snippet-support"],
    controls: {
      reject: ['[data-tid="banner-decline"]'],
      accept: ['[data-tid="banner-accept"]'],
    },
  },
  {
    id: "funding-choices",
    containers: [".fc-consent-root"],
    controls: {
      reject: [".fc-cta-do-not-consent"],
      accept: [".fc-cta-consent"],
      settings: [".fc-cta-manage-options"],
    },
  },
  {
    id: "trustarc",
    containers: ["#truste-consent-track"],
    controls: {
      necessary: ["#truste-consent-required"],
      accept: ["#truste-consent-button"],
    },
  },
];

/** Known containers as one CSS selector list, injected at document_start. */
export const KNOWN_CONTAINER_SELECTOR = CMP_SIGNATURES.flatMap(
  (sig) => sig.containers,
).join(",");
