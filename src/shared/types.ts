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
  // Template-literal form (not the bare enum) because chrome.management's
  // own ExtensionInfo.installType is typed this way — matching it means
  // real API results and plain string literals ("normal", etc.) both
  // satisfy this without a cast.
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
