/**
 * Shared data contracts for ExtSentinel.
 *
 * These types are the boundary between the background scanning/scoring
 * logic (src/core/**) and the popup/options UI (entrypoints/popup,
 * entrypoints/options). Both halves of the project are built against this
 * file independently, so changes here require coordination between both
 * contributors.
 */

/** A point-in-time snapshot of one installed extension's state and risk. */
export interface ExtensionSnapshot {
  id: string;
  name: string;
  version: string;
  permissions: string[];
  hostPermissions: string[];
  // Template-literal form, not the enum itself: chrome.management.getAll()
  // returns installType as a plain string union, and TS enums don't accept
  // raw string literals even when the value matches. This form is
  // structurally identical to chrome.management.ExtensionInfo's own field.
  installType: `${chrome.management.ExtensionInstallType}`;
  enabled: boolean;
  riskScore: number;
  riskTier: "low" | "medium" | "high" | "critical";
}

/**
 * A detected permission escalation between two scans of the same
 * extension, e.g. after it auto-updates.
 */
export interface PermissionChange {
  extensionId: string;
  extensionName: string;
  addedPermissions: string[];
  addedHostPermissions: string[];
  previousVersion: string;
  newVersion: string;
  detectedAt: number;
}

/** The full output of a single scan pass over all installed extensions. */
export interface ScanResult {
  scannedAt: number;
  extensions: ExtensionSnapshot[];
  changes: PermissionChange[];
}
