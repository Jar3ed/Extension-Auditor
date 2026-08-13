import type { ExtensionSnapshot, PermissionChange } from "../../shared/types";
import { RiskBadge } from "./RiskBadge";
import { PermissionList } from "./PermissionList";
import { ChangeTimeline } from "./ChangeTimeline";

const INSTALL_TYPE_LABEL: Record<string, string> = {
  admin: "Installed by policy",
  development: "Unpacked (developer mode)",
  normal: "Installed normally",
  sideload: "Sideloaded",
  other: "Installed by other software",
};

export function ExtensionDetail({
  extension,
  changes,
  onBack,
}: {
  extension: ExtensionSnapshot;
  changes: PermissionChange[];
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="rounded px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          ← Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {extension.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              v{extension.version} ·{" "}
              {INSTALL_TYPE_LABEL[extension.installType] ??
                extension.installType}
            </p>
          </div>
          <RiskBadge tier={extension.riskTier} />
        </div>

        <section className="mt-4">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Permissions
          </h3>
          <div className="mt-2">
            <PermissionList
              permissions={extension.permissions}
              hostPermissions={extension.hostPermissions}
            />
          </div>
        </section>

        <section className="mt-4">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            What changed
          </h3>
          <div className="mt-2">
            <ChangeTimeline changes={changes} />
          </div>
        </section>
      </div>
    </div>
  );
}
