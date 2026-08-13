/**
 * Permission risk scoring.
 *
 * Pure, framework-agnostic: no chrome.* calls in here, just data in / data
 * out, so it's easy to unit test and re-tune the weights below without
 * touching scanning logic. This is a heuristic score, not a malware
 * verdict — see the README threat model section.
 */

import type { ExtensionSnapshot } from "../shared/types";
import { isBroadHostPermission } from "./hostPatterns";

/**
 * Base per-permission weights, expressed as data so the scoring can be
 * re-tuned without touching logic. "scripting" is deliberately excluded —
 * its weight depends on whether it's paired with broad host access (see
 * SCRIPTING_WEIGHT_* below), which isn't a simple per-permission lookup.
 */
export const PERMISSION_WEIGHTS: Record<string, number> = {
  // Critical (10 pts each)
  management: 10,
  debugger: 10,
  proxy: 10,
  nativeMessaging: 10,

  // High (7 pts each)
  cookies: 7,
  history: 7,
  tabs: 7,
  downloads: 7,
  clipboardWrite: 7,
  clipboardRead: 7,
  webRequest: 7,

  // Medium (4 pts each)
  bookmarks: 4,
  geolocation: 4,
  notifications: 4,
  contextMenus: 4,
  identity: 4,
  background: 4,

  // Low (1 pt each)
  storage: 1,
  alarms: 1,
  activeTab: 1,
  action: 1,
};

/** Points per broad ("<all_urls>" or bare "*://*" + "/*") host permission entry. */
export const BROAD_HOST_PERMISSION_WEIGHT = 10;

/**
 * "scripting" only scores as high-risk when paired with broad host access;
 * scripting + activeTab alone (the common, narrow pattern) is much lower
 * risk since it only runs on tabs the user explicitly acts on.
 */
export const SCRIPTING_WEIGHT_WITH_BROAD_HOSTS = 7;
export const SCRIPTING_WEIGHT_NARROW = 1;

const INSTALL_TYPE_RISK_MULTIPLIER = 1.5;
const MANIFEST_V2_PENALTY = 5;

const RISK_TIER_MAX_THRESHOLDS: Array<[max: number, tier: ExtensionSnapshot["riskTier"]]> = [
  [9, "low"],
  [19, "medium"],
  [34, "high"],
];

function scoreToTier(score: number): ExtensionSnapshot["riskTier"] {
  for (const [max, tier] of RISK_TIER_MAX_THRESHOLDS) {
    if (score <= max) return tier;
  }
  return "critical";
}

export function scoreRisk(
  permissions: string[],
  hostPermissions: string[],
  // Typed as the string union chrome.management.getAll() actually returns
  // (not the ExtensionInstallType enum the shared ExtensionSnapshot type
  // uses) so callers — including tests — can pass plain string literals.
  // The enum type is still assignable in, since its values are a subset.
  installType: `${chrome.management.ExtensionInstallType}`,
  manifestVersion: number,
): Pick<ExtensionSnapshot, "riskScore" | "riskTier"> {
  let score = 0;

  for (const permission of permissions) {
    if (permission === "scripting") continue; // scored below, conditional on host access
    score += PERMISSION_WEIGHTS[permission] ?? 0;
  }

  const hasBroadHostPermission = hostPermissions.some(isBroadHostPermission);

  if (permissions.includes("scripting")) {
    score += hasBroadHostPermission
      ? SCRIPTING_WEIGHT_WITH_BROAD_HOSTS
      : SCRIPTING_WEIGHT_NARROW;
  }

  const broadHostPermissionCount = hostPermissions.filter(isBroadHostPermission).length;
  score += broadHostPermissionCount * BROAD_HOST_PERMISSION_WEIGHT;

  // installType === "admin" (org-managed via enterprise policy) is
  // deliberately excluded from the multiplier below. The existing
  // `installType` field on ExtensionSnapshot already doubles as the
  // "org-managed" flag — consumers can check `installType === "admin"`
  // directly, so no separate field on the shared type is needed.
  if (installType !== "normal" && installType !== "admin") {
    score *= INSTALL_TYPE_RISK_MULTIPLIER;
  }

  if (manifestVersion === 2) {
    score += MANIFEST_V2_PENALTY;
  }

  return {
    riskScore: score,
    riskTier: scoreToTier(score),
  };
}
