/**
 * Presentation-only heuristic for grouping an extension's raw permission
 * strings into "sensitive" vs "standard" when rendering the drill-down
 * view. This is NOT the real risk-scoring engine — that's
 * src/core/riskScorer.ts (backend territory) and produces the
 * authoritative riskScore/riskTier on ExtensionSnapshot. This just
 * decides how to visually group a permission list.
 */

const SENSITIVE_PERMISSIONS = new Set([
  "debugger",
  "proxy",
  "webRequest",
  "webRequestBlocking",
  "declarativeNetRequest",
  "management",
  "cookies",
  "tabs",
  "history",
  "nativeMessaging",
]);

export function isSensitivePermission(permission: string): boolean {
  return SENSITIVE_PERMISSIONS.has(permission);
}

export function isBroadHostPermission(hostPermission: string): boolean {
  return hostPermission === "<all_urls>" || hostPermission.includes("*://*/");
}
