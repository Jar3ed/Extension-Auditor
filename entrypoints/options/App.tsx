/**
 * Settings page. Currently just the scan interval control, persisted to
 * chrome.storage.local under SCAN_INTERVAL_STORAGE_KEY. The background
 * worker listens for changes to that key and reschedules its alarm
 * accordingly (see entrypoints/background.ts).
 */

import { useEffect, useState } from "react";
import {
  DEFAULT_SCAN_INTERVAL_MINUTES,
  MAX_SCAN_INTERVAL_MINUTES,
  MIN_SCAN_INTERVAL_MINUTES,
  SCAN_INTERVAL_STORAGE_KEY,
} from "../../src/shared/settings";

function clamp(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_SCAN_INTERVAL_MINUTES;
  return Math.min(
    MAX_SCAN_INTERVAL_MINUTES,
    Math.max(MIN_SCAN_INTERVAL_MINUTES, value),
  );
}

export default function App() {
  // null while the stored value is still loading.
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const stored = await chrome.storage.local.get(SCAN_INTERVAL_STORAGE_KEY);
      if (!ignore) {
        const value = stored[SCAN_INTERVAL_STORAGE_KEY];
        setMinutes(
          typeof value === "number" ? value : DEFAULT_SCAN_INTERVAL_MINUTES,
        );
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (minutes === null) return;
    const handle = setTimeout(() => {
      chrome.storage.local.set({ [SCAN_INTERVAL_STORAGE_KEY]: minutes });
    }, 300);
    return () => clearTimeout(handle);
  }, [minutes]);

  return (
    <div className="mx-auto max-w-md p-6 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <h1 className="text-lg font-semibold">ExtSentinel Settings</h1>

      <div className="mt-6">
        <label
          htmlFor="scan-interval"
          className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Scan interval
        </label>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          How often ExtSentinel checks your installed extensions for permission
          changes, in minutes ({MIN_SCAN_INTERVAL_MINUTES}–
          {MAX_SCAN_INTERVAL_MINUTES}).
        </p>

        <div className="mt-2 flex items-center gap-2">
          <input
            id="scan-interval"
            type="number"
            min={MIN_SCAN_INTERVAL_MINUTES}
            max={MAX_SCAN_INTERVAL_MINUTES}
            step={15}
            disabled={minutes === null}
            value={minutes ?? ""}
            onChange={(e) => setMinutes(Number(e.target.value))}
            onBlur={(e) => setMinutes(clamp(Number(e.target.value)))}
            className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            minutes
          </span>
        </div>
      </div>
    </div>
  );
}
