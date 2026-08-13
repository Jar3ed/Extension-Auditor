/**
 * Message contract for chrome.runtime.sendMessage / onMessage traffic
 * between the popup/options UI and the background service worker.
 *
 * Discriminated on `type` so callers get exhaustive switch-checking on
 * both the request and response sides.
 */
import type { ExtensionSnapshot, ScanResult } from "./types";

export type RuntimeMessage =
  | { type: "GET_LATEST_SCAN" }
  | { type: "TRIGGER_SCAN" }
  | { type: "GET_HISTORY"; extensionId: string };

export type RuntimeResponse =
  | { type: "SCAN_RESULT"; payload: ScanResult }
  | { type: "SCAN_IN_PROGRESS" }
  | { type: "EXTENSION_HISTORY"; payload: ExtensionSnapshot[] }
  | { type: "ERROR"; message: string };
