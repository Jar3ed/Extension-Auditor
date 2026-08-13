/**
 * Permission risk scoring.
 *
 * TODO: Map an extension's requested permissions + host permissions to a
 * numeric riskScore and a riskTier ("low" | "medium" | "high" |
 * "critical"). This is a heuristic score, not a malware verdict — see the
 * README threat model section.
 * TODO: Consider weighting factors like: broad host access (<all_urls>),
 * sensitive API permissions (e.g. "debugger", "proxy", "webRequest"),
 * and installType (sideloaded/unpacked extensions score higher risk).
 */

import type { ExtensionSnapshot } from "../shared/types";

export function scoreRisk(
  _permissions: string[],
  _hostPermissions: string[],
): Pick<ExtensionSnapshot, "riskScore" | "riskTier"> {
  throw new Error("TODO: not implemented");
}
