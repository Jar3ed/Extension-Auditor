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

export async function getHistory(extensionId: string): Promise<ExtensionSnapshot[]> {
  const key = historyKey(extensionId);
  const result = await chrome.storage.local.get(key);
  return (result[key] as ExtensionSnapshot[] | undefined) ?? [];
}

export async function getLatestSnapshot(
  extensionId: string,
): Promise<ExtensionSnapshot | undefined> {
  const history = await getHistory(extensionId);
  return history[history.length - 1];
}

export async function saveSnapshot(snapshot: ExtensionSnapshot): Promise<void> {
  const history = await getHistory(snapshot.id);
  const updated = [...history, snapshot].slice(-HISTORY_LIMIT);
  await chrome.storage.local.set({ [historyKey(snapshot.id)]: updated });
}
