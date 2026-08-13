/**
 * Scanning logic.
 *
 * TODO: Use chrome.management.getAll() to enumerate installed extensions
 * and build an ExtensionSnapshot[] for the current state of the system.
 * TODO: Score each extension via riskScorer, and persist the result via
 * storage.ts.
 * TODO: Called on an alarm interval (see entrypoints/background.ts) and
 * on-demand via the TRIGGER_SCAN runtime message.
 */

import type { ScanResult } from "../shared/types";

export async function runScan(): Promise<ScanResult> {
  throw new Error("TODO: not implemented");
}
