import type { ExtensionSnapshot, PermissionChange } from "../../shared/types";
import { ExtensionListItem } from "./ExtensionListItem";

export function ExtensionList({
  extensions,
  changes,
  onSelect,
}: {
  extensions: ExtensionSnapshot[];
  changes: PermissionChange[];
  onSelect: (id: string) => void;
}) {
  const changedIds = new Set(changes.map((change) => change.extensionId));
  const sorted = [...extensions].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {sorted.map((extension) => (
        <ExtensionListItem
          key={extension.id}
          extension={extension}
          hasRecentChange={changedIds.has(extension.id)}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
