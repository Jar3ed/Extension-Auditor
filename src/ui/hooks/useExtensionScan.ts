/**
 * Thin messaging layer between the popup/options UI and the background
 * service worker, typed against src/shared/messages.ts.
 *
 * Set USE_MOCK_DATA to false once the real background message handlers
 * exist (see entrypoints/background.ts) — that's the only line that
 * needs to change to swap mock data for the real thing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { RuntimeMessage, RuntimeResponse } from "../../shared/messages";
import type { ScanResult } from "../../shared/types";
import { mockScanResult } from "../mockData";

const USE_MOCK_DATA = true;

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

let mockScanInFlight = false;

async function mockSendMessage(
  message: RuntimeMessage,
): Promise<RuntimeResponse> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  switch (message.type) {
    case "GET_LATEST_SCAN":
      return { type: "SCAN_RESULT", payload: mockScanResult };

    case "TRIGGER_SCAN": {
      if (mockScanInFlight) {
        return { type: "SCAN_IN_PROGRESS" };
      }
      mockScanInFlight = true;
      setTimeout(() => {
        mockScanInFlight = false;
      }, MOCK_SCAN_DURATION_MS);
      return { type: "SCAN_IN_PROGRESS" };
    }

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
 * Loads the latest scan on mount and exposes a `triggerScan` action that
 * polls until an in-progress scan completes. Backed by mock data until
 * USE_MOCK_DATA is flipped off above.
 */
export function useExtensionScan() {
  const [state, setState] = useState<ScanState>({ status: "loading" });
  const pollTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const applyResponse = useCallback((response: RuntimeResponse) => {
    if (response.type === "SCAN_RESULT") {
      setState({ status: "ready", result: response.payload });
    } else if (response.type === "ERROR") {
      setState({ status: "error", message: response.message });
    }
    // SCAN_IN_PROGRESS is handled by the caller (it keeps polling).
  }, []);

  // No eager `setState({ status: "loading" })` here: the initial state is
  // already "loading", and this function is only called synchronously
  // from the mount effect below (setting state before the first await,
  // inside an effect, trips the react-hooks set-state-in-effect rule).
  const fetchLatest = useCallback(async () => {
    try {
      const response = await sendRuntimeMessage({ type: "GET_LATEST_SCAN" });
      applyResponse(response);
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [applyResponse]);

  const triggerScan = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const response = await sendRuntimeMessage({ type: "TRIGGER_SCAN" });
      if (response.type === "SCAN_IN_PROGRESS") {
        const poll = async () => {
          const latest = await sendRuntimeMessage({ type: "GET_LATEST_SCAN" });
          if (latest.type === "SCAN_RESULT" && !mockScanInFlight) {
            applyResponse(latest);
          } else {
            pollTimeout.current = setTimeout(poll, 500);
          }
        };
        pollTimeout.current = setTimeout(poll, 500);
      } else {
        applyResponse(response);
      }
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [applyResponse]);

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
      clearTimeout(pollTimeout.current);
    };
  }, [applyResponse]);

  return { state, triggerScan, refetch: fetchLatest };
}
