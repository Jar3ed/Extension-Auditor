/**
 * Background service worker.
 *
 * Owns the recurring scan alarm and the runtime message handler. Orchestrates
 * scan -> diff (against stored history) -> score -> save; src/core/** stays
 * framework-agnostic and doesn't know about chrome.alarms/runtime itself.
 */

import type { RuntimeMessage, RuntimeResponse } from "../src/shared/messages";
import type {
  ExtensionSnapshot,
  PermissionChange,
  ScanResult,
} from "../src/shared/types";
import {
  DEFAULT_SCAN_INTERVAL_MINUTES,
  SCAN_INTERVAL_STORAGE_KEY,
} from "../src/shared/settings";
import { scanInstalledExtensions } from "../src/core/scanner";
import { scoreRisk } from "../src/core/riskScorer";
import { diffSnapshots } from "../src/core/diff";
import {
  getHistories,
  getHistory,
  getLatestScan,
  saveScanAndSnapshots,
} from "../src/core/storage";

const SCAN_ALARM_NAME = "extsentinel-scan";

async function getScanIntervalMinutes(): Promise<number> {
  const stored = await chrome.storage.local.get(SCAN_INTERVAL_STORAGE_KEY);
  const value = stored[SCAN_INTERVAL_STORAGE_KEY];
  return typeof value === "number" ? value : DEFAULT_SCAN_INTERVAL_MINUTES;
}

/**
 * Creates the scan alarm if missing, or reschedules it if the configured
 * interval (chrome.storage.local, written by the options page) no longer
 * matches the alarm's current period. chrome.alarms.create replaces any
 * existing alarm with the same name, so this is safe to call whenever the
 * setting changes, not just on install/startup.
 */
async function ensureScanAlarm(): Promise<void> {
  const periodInMinutes = await getScanIntervalMinutes();
  const existing = await chrome.alarms.get(SCAN_ALARM_NAME);
  if (existing && existing.periodInMinutes === periodInMinutes) return;
  chrome.alarms.create(SCAN_ALARM_NAME, {
    periodInMinutes,
    persistAcrossSessions: true,
  });
}

/**
 * Runs a full scan pass. History is read for every extension in one
 * batched call up front, and every extension's updated history plus the
 * new ScanResult are written in a single batched call at the end — no
 * chrome.storage.local round trip inside the per-extension loop.
 */
async function performScan(): Promise<ScanResult> {
  const rawSnapshots = await scanInstalledExtensions();
  const histories = await getHistories(rawSnapshots.map((raw) => raw.id));

  const scored: ExtensionSnapshot[] = [];
  const changes: PermissionChange[] = [];

  for (const raw of rawSnapshots) {
    const { riskScore, riskTier } = scoreRisk(
      raw.permissions,
      raw.hostPermissions,
      raw.installType,
    );
    const snapshot: ExtensionSnapshot = { ...raw, riskScore, riskTier };

    const previous = histories[raw.id]?.at(-1);
    const change = diffSnapshots(previous, snapshot);
    if (change) changes.push(change);

    scored.push(snapshot);
  }

  const result: ScanResult = {
    scannedAt: Date.now(),
    extensions: scored,
    changes,
  };
  await saveScanAndSnapshots(result, scored, histories);
  return result;
}

let scanInFlight: Promise<ScanResult> | null = null;

/**
 * Single-flight wrapper around performScan(): the alarm, TRIGGER_SCAN,
 * and a GET_LATEST_SCAN cache-miss can all want to run a scan around the
 * same time, and letting them run concurrently let their storage writes
 * interleave. Every caller now awaits the same in-flight scan instead of
 * starting a second overlapping one.
 */
function runScan(): Promise<ScanResult> {
  if (!scanInFlight) {
    scanInFlight = performScan().finally(() => {
      scanInFlight = null;
    });
  }
  return scanInFlight;
}

function broadcast(response: RuntimeResponse): void {
  chrome.runtime.sendMessage(response).catch(() => {
    // No listener currently open (e.g. popup closed) — the result is
    // already persisted, so the next GET_LATEST_SCAN picks it up.
  });
}

/** Runs a scan and broadcasts its outcome (success or failure) once done. */
function runScanAndBroadcast(): void {
  runScan()
    .then((result) => broadcast({ type: "SCAN_RESULT", payload: result }))
    .catch((error) => {
      console.error("ExtSentinel scan failed:", error);
      broadcast({ type: "ERROR", message: String(error) });
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
    runScanAndBroadcast();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (SCAN_INTERVAL_STORAGE_KEY in changes) {
      void ensureScanAlarm();
    }
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
              const result = existing ?? (await runScan());
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
          runScanAndBroadcast();
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
