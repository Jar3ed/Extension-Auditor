import type { ExtensionSnapshot } from "../../shared/types";
import { RiskBadge } from "./RiskBadge";

export function ExtensionListItem({
  extension,
  hasRecentChange,
  onSelect,
}: {
  extension: ExtensionSnapshot;
  hasRecentChange: boolean;
  onSelect: (id: string) => void;
}) {
  const permissionCount =
    extension.permissions.length + extension.hostPermissions.length;

  return (
    <button
      type="button"
      onClick={() => onSelect(extension.id)}
      className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {extension.name}
          </span>
          {hasRecentChange && (
            <span
              title="Permissions changed recently"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            />
          )}
          {!extension.enabled && (
            <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
              (disabled)
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          v{extension.version} · {permissionCount} permission
          {permissionCount === 1 ? "" : "s"}
        </div>
      </div>
      <RiskBadge tier={extension.riskTier} />
    </button>
  );
}
