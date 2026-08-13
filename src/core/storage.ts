/**
 * Persistence layer, backed by chrome.storage.local.
 *
 * Stores the most recent full ScanResult (for quick popup retrieval without
 * recomputing) plus a rolling per-extension snapshot history, capped at
 * HISTORY_LIMIT entries so storage doesn't grow unbounded.
 */

import type { ExtensionSnapshot, ScanResult } from "../shared/types";

const HISTORY_LIMIT = 10;
const LATEST_SCAN_KEY = "latestScan";

function historyKey(extensionId: string): string {
  return `history:${extensionId}`;
}

export async function getLatestScan(): Promise<ScanResult | undefined> {
  const result = await chrome.storage.local.get(LATEST_SCAN_KEY);
  return result[LATEST_SCAN_KEY] as ScanResult | undefined;
}

export async function saveScan(result: ScanResult): Promise<void> {
  await chrome.storage.local.set({ [LATEST_SCAN_KEY]: result });
}

export async function getHistory(
  extensionId: string,
): Promise<ExtensionSnapshot[]> {
  const key = historyKey(extensionId);
  const result = await chrome.storage.local.get(key);
  return (result[key] as ExtensionSnapshot[] | undefined) ?? [];
}

/**
 * Batched form of getHistory for a whole scan pass: one
 * chrome.storage.local.get() for every extension's history instead of one
 * round trip per extension.
 */
export async function getHistories(
  extensionIds: string[],
): Promise<Record<string, ExtensionSnapshot[]>> {
  if (extensionIds.length === 0) return {};
  const keys = extensionIds.map(historyKey);
  const result = await chrome.storage.local.get(keys);
  const histories: Record<string, ExtensionSnapshot[]> = {};
  for (const id of extensionIds) {
    histories[id] =
      (result[historyKey(id)] as ExtensionSnapshot[] | undefined) ?? [];
  }
  return histories;
}

/**
 * Persists a full scan pass — the ScanResult plus each extension's
 * updated history — in a single chrome.storage.local.set() call, given
 * the histories already fetched via getHistories() before scoring.
 */
export async function saveScanAndSnapshots(
  result: ScanResult,
  snapshots: ExtensionSnapshot[],
  histories: Record<string, ExtensionSnapshot[]>,
): Promise<void> {
  const updates: Record<string, unknown> = { [LATEST_SCAN_KEY]: result };
  for (const snapshot of snapshots) {
    const history = histories[snapshot.id] ?? [];
    updates[historyKey(snapshot.id)] = [...history, snapshot].slice(
      -HISTORY_LIMIT,
    );
  }
  await chrome.storage.local.set(updates);
}
