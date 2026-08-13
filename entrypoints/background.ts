/**
 * Background service worker.
 *
 * TODO: On install/startup, register a chrome.alarms interval (interval
 * configurable from the options page) that triggers src/core/scanner.ts.
 * TODO: Listen for RuntimeMessage (GET_LATEST_SCAN, TRIGGER_SCAN,
 * GET_HISTORY) via chrome.runtime.onMessage and respond with a
 * RuntimeResponse, delegating to scanner.ts / storage.ts.
 */

export default defineBackground(() => {
  // TODO: wire up alarms + message listener here.
});
