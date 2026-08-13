/**
 * Thin messaging layer between the popup/options UI and the background
 * service worker, typed against src/shared/messages.ts.
 *
 * USE_MOCK_DATA is off now that entrypoints/background.ts is real and
 * verified end to end — flip it back to true for offline UI iteration
 * (e.g. no working background worker loaded) without touching anything
 * else in this file.
 */

import { useCallback, useEffect, useState } from "react";
import type { RuntimeMessage, RuntimeResponse } from "../../shared/messages";
import type { ScanResult } from "../../shared/types";
import { mockScanResult } from "../mockData";

const USE_MOCK_DATA = false;

const MOCK_LATENCY_MS = 400;
// How long TRIGGER_SCAN takes to "finish" in the mock, so the UI's
// loading/SCAN_IN_PROGRESS path is actually exercisable during dev.
const MOCK_SCAN_DURATION_MS = 1200;

async function sendRuntimeMessage(
  message: RuntimeMessage,
): Promise<RuntimeResponse> {
  if (USE_MOCK_DATA) {
    return mockSendMessage(message);
  }
  return chrome.runtime.sendMessage(message);
}

async function mockSendMessage(
  message: RuntimeMessage,
): Promise<RuntimeResponse> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  switch (message.type) {
    case "GET_LATEST_SCAN":
      return { type: "SCAN_RESULT", payload: mockScanResult };

    case "TRIGGER_SCAN":
      // The real background worker responds immediately with this, then
      // pushes a SCAN_RESULT/ERROR broadcast once the scan actually
      // finishes (see entrypoints/background.ts) — it does not wait for
      // a follow-up GET_LATEST_SCAN to hand back the fresh result.
      // triggerScan() below simulates that broadcast in mock mode.
      return { type: "SCAN_IN_PROGRESS" };

    case "GET_HISTORY": {
      const snapshot = mockScanResult.extensions.find(
        (ext) => ext.id === message.extensionId,
      );
      if (!snapshot) {
        return {
          type: "ERROR",
          message: `No history found for extension ${message.extensionId}`,
        };
      }
      return { type: "EXTENSION_HISTORY", payload: [snapshot] };
    }
  }
}

type ScanState =
  | { status: "loading" }
  | { status: "ready"; result: ScanResult }
  | { status: "error"; message: string };

/**
 * Loads the latest scan on mount, listens for the background worker's
 * unsolicited SCAN_RESULT/ERROR broadcast (pushed once a scan completes,
 * whether triggered by us or by its own alarm), and exposes a
 * triggerScan action. Backed by mock data until USE_MOCK_DATA is flipped
 * off above.
 */
export function useExtensionScan() {
  const [state, setState] = useState<ScanState>({ status: "loading" });

  const applyResponse = useCallback((response: RuntimeResponse) => {
    if (response.type === "SCAN_RESULT") {
      setState({ status: "ready", result: response.payload });
    } else if (response.type === "ERROR") {
      setState({ status: "error", message: response.message });
    }
    // SCAN_IN_PROGRESS: nothing to do — wait for the broadcast (or, in
    // mock mode, the simulated one in triggerScan below).
  }, []);

  // Initial load on mount.
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const response = await sendRuntimeMessage({ type: "GET_LATEST_SCAN" });
        if (!ignore) applyResponse(response);
      } catch (err) {
        if (!ignore) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [applyResponse]);

  // The background worker pushes SCAN_RESULT/ERROR as an unsolicited
  // chrome.runtime.sendMessage broadcast, not a response tied to any one
  // request — so this listener stays registered for the popup's lifetime
  // rather than only around a triggerScan() call.
  useEffect(() => {
    if (USE_MOCK_DATA) return;
    const listener = (message: RuntimeResponse) => {
      if (message.type === "SCAN_RESULT" || message.type === "ERROR") {
        applyResponse(message);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [applyResponse]);

  const triggerScan = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const response = await sendRuntimeMessage({ type: "TRIGGER_SCAN" });
      if (response.type !== "SCAN_IN_PROGRESS") {
        applyResponse(response);
        return;
      }
      if (USE_MOCK_DATA) {
        // No real background worker to broadcast completion — simulate one.
        setTimeout(() => {
          applyResponse({ type: "SCAN_RESULT", payload: mockScanResult });
        }, MOCK_SCAN_DURATION_MS);
      }
      // Real mode: the persistent onMessage listener above picks up the
      // eventual broadcast.
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [applyResponse]);

  return { state, triggerScan };
}
