/**
 * Persistence layer, backed by chrome.storage.local.
 *
 * TODO: Store/retrieve the latest ScanResult and a bounded history of
 * past ExtensionSnapshots per extension id (for the GET_HISTORY message
 * and for diff.ts to compare against on the next scan).
 * TODO: Decide on a retention policy (e.g. keep last N snapshots per
 * extension) so storage doesn't grow unbounded.
 */

import type { ExtensionSnapshot, ScanResult } from "../shared/types";

export async function getLatestScan(): Promise<ScanResult | undefined> {
  throw new Error("TODO: not implemented");
}

export async function saveScan(_result: ScanResult): Promise<void> {
  throw new Error("TODO: not implemented");
}

export async function getHistory(
  _extensionId: string,
): Promise<ExtensionSnapshot[]> {
  throw new Error("TODO: not implemented");
}
