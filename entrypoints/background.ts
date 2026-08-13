/**
 * Background service worker.
 *
 * Owns the recurring scan alarm and the runtime message handler. Orchestrates
 * scan -> diff (against stored history) -> score -> save; src/core/** stays
 * framework-agnostic and doesn't know about chrome.alarms/runtime itself.
 */

import type { RuntimeMessage, RuntimeResponse } from "../src/shared/messages";
import type { ExtensionSnapshot, PermissionChange, ScanResult } from "../src/shared/types";
import { scanInstalledExtensions } from "../src/core/scanner";
import { scoreRisk } from "../src/core/riskScorer";
import { diffSnapshots } from "../src/core/diff";
import {
  getHistory,
  getLatestScan,
  getLatestSnapshot,
  saveScan,
  saveSnapshot,
} from "../src/core/storage";

const SCAN_ALARM_NAME = "extsentinel-scan";
const DEFAULT_SCAN_INTERVAL_MINUTES = 60;

async function ensureScanAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(SCAN_ALARM_NAME);
  if (existing) return;
  chrome.alarms.create(SCAN_ALARM_NAME, {
    periodInMinutes: DEFAULT_SCAN_INTERVAL_MINUTES,
    // Chrome 117+. May need an @ts-expect-error if @types/chrome lags.
    persistAcrossSessions: true,
  } as chrome.alarms.AlarmCreateInfo);
}

/**
 * Runs a full scan pass. Kept sequential and self-contained per extension
 * (score -> diff -> save) rather than batching everything at the end, since
 * the service worker can be killed mid-execution if it looks idle during a
 * slow await.
 */
async function performScan(): Promise<ScanResult> {
  const rawSnapshots = await scanInstalledExtensions();
  const scored: ExtensionSnapshot[] = [];
  const changes: PermissionChange[] = [];

  for (const raw of rawSnapshots) {
    const { riskScore, riskTier } = scoreRisk(
      raw.permissions,
      raw.hostPermissions,
      raw.installType,
    );
    const snapshot: ExtensionSnapshot = { ...raw, riskScore, riskTier };

    const previous = await getLatestSnapshot(snapshot.id);
    const change = diffSnapshots(previous, snapshot);
    if (change) changes.push(change);

    await saveSnapshot(snapshot);
    scored.push(snapshot);
  }

  const result: ScanResult = {
    scannedAt: Date.now(),
    extensions: scored,
    changes,
  };
  await saveScan(result);
  return result;
}

function broadcast(response: RuntimeResponse): void {
  chrome.runtime.sendMessage(response).catch(() => {
    // No listener currently open (e.g. popup closed) — the result is
    // already persisted, so the next GET_LATEST_SCAN picks it up.
  });
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    void ensureScanAlarm();
  });
  chrome.runtime.onStartup.addListener(() => {
    void ensureScanAlarm();
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== SCAN_ALARM_NAME) return;
    void performScan();
  });

  chrome.runtime.onMessage.addListener(
    (
      message: RuntimeMessage,
      _sender,
      sendResponse: (response: RuntimeResponse) => void,
    ) => {
      switch (message.type) {
        case "GET_LATEST_SCAN": {
          void (async () => {
            try {
              const existing = await getLatestScan();
              const result = existing ?? (await performScan());
              sendResponse({ type: "SCAN_RESULT", payload: result });
            } catch (error) {
              sendResponse({ type: "ERROR", message: String(error) });
            }
          })();
          return true; // keep the message port open for the async response
        }

        case "TRIGGER_SCAN": {
          // Respond immediately; the real result follows as a separate
          // broadcast once the scan finishes, so we don't hold the message
          // port open for the full scan duration.
          sendResponse({ type: "SCAN_IN_PROGRESS" });
          performScan()
            .then((result) => broadcast({ type: "SCAN_RESULT", payload: result }))
            .catch((error) =>
              broadcast({ type: "ERROR", message: String(error) }),
            );
          return false;
        }

        case "GET_HISTORY": {
          void (async () => {
            try {
              const history = await getHistory(message.extensionId);
              sendResponse({ type: "EXTENSION_HISTORY", payload: history });
            } catch (error) {
              sendResponse({ type: "ERROR", message: String(error) });
            }
          })();
          return true;
        }

        default:
          return false;
      }
    },
  );
});
