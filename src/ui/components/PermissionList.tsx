import {
  isBroadHostPermission,
  isSensitivePermission,
} from "../lib/permissionDisplay";

function Group({
  title,
  items,
  emphasize,
}: {
  title: string;
  items: string[];
  emphasize: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h4>
      <ul className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => (
          <li
            key={item}
            className={`rounded px-1.5 py-0.5 font-mono text-xs ${
              emphasize
                ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PermissionList({
  permissions,
  hostPermissions,
}: {
  permissions: string[];
  hostPermissions: string[];
}) {
  const sensitive = permissions.filter(isSensitivePermission);
  const standard = permissions.filter((p) => !isSensitivePermission(p));
  const broadHosts = hostPermissions.filter(isBroadHostPermission);
  const scopedHosts = hostPermissions.filter((h) => !isBroadHostPermission(h));

  if (permissions.length === 0 && hostPermissions.length === 0) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        This extension requests no permissions.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Group title="Sensitive permissions" items={sensitive} emphasize />
      <Group title="Broad host access" items={broadHosts} emphasize />
      <Group title="Standard permissions" items={standard} emphasize={false} />
      <Group title="Scoped host access" items={scopedHosts} emphasize={false} />
    </div>
  );
}
