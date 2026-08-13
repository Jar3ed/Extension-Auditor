/**
 * Popup dashboard root. Loads the latest scan via useExtensionScan
 * (mock data until the background worker exists — see that hook) and
 * renders the extension list, a drill-down detail view, or an
 * empty/error/loading state depending on what's happened so far.
 */

import { useState } from "react";
import { useExtensionScan } from "../../src/ui/hooks/useExtensionScan";
import { ExtensionList } from "../../src/ui/components/ExtensionList";
import { ExtensionDetail } from "../../src/ui/components/ExtensionDetail";
import { ScanButton } from "../../src/ui/components/ScanButton";
import { EmptyState } from "../../src/ui/components/EmptyState";
import { ErrorState } from "../../src/ui/components/ErrorState";

export default function App() {
  const { state, triggerScan } = useExtensionScan();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loading = state.status === "loading";

  return (
    <div className="flex h-[480px] w-96 flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
        <h1 className="text-sm font-semibold">ExtSentinel</h1>
        <ScanButton onClick={triggerScan} loading={loading} />
      </header>

      <div className="flex-1 overflow-y-auto">
        {state.status === "error" ? (
          <ErrorState message={state.message} onRetry={triggerScan} />
        ) : state.status === "loading" ? (
          <p className="px-3 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Loading…
          </p>
        ) : (
          (() => {
            const { result } = state;
            const selected = selectedId
              ? result.extensions.find((ext) => ext.id === selectedId)
              : undefined;

            if (selected) {
              return (
                <ExtensionDetail
                  extension={selected}
                  changes={result.changes.filter(
                    (change) => change.extensionId === selected.id,
                  )}
                  onBack={() => setSelectedId(null)}
                />
              );
            }

            if (result.extensions.length === 0) {
              return <EmptyState onScan={triggerScan} loading={loading} />;
            }

            return (
              <ExtensionList
                extensions={result.extensions}
                changes={result.changes}
                onSelect={setSelectedId}
              />
            );
          })()
        )}
      </div>
    </div>
  );
}
