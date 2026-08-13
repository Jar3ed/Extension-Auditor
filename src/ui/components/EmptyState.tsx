import { ScanButton } from "./ScanButton";

export function EmptyState({
  onScan,
  loading,
}: {
  onScan: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
        No scan yet
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Run a scan to see the permission risk of your installed extensions.
      </p>
      <ScanButton onClick={onScan} loading={loading} />
    </div>
  );
}
