import type { PermissionChange } from "../../shared/types";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ChangeTimeline({ changes }: { changes: PermissionChange[] }) {
  const sorted = [...changes].sort((a, b) => b.detectedAt - a.detectedAt);

  if (sorted.length === 0) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        No permission changes detected yet.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {sorted.map((change, i) => (
        <li
          key={`${change.detectedAt}-${i}`}
          className="border-l-2 border-amber-400 pl-3 dark:border-amber-600"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              v{change.previousVersion} → v{change.newVersion}
            </span>
            <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
              {formatDate(change.detectedAt)}
            </span>
          </div>
          {change.addedPermissions.length > 0 && (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Added permissions: {change.addedPermissions.join(", ")}
            </p>
          )}
          {change.addedHostPermissions.length > 0 && (
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Added host access: {change.addedHostPermissions.join(", ")}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
