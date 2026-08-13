/**
 * Permission-escalation detection.
 *
 * Flags a change whenever:
 *  - the version string changed AND permissions or hostPermissions grew, or
 *  - a newly-broad host permission (<all_urls> / bare "*://*\/*") appears,
 *    regardless of whether the version changed.
 *
 * A version bump with a permission increase is the highest-value signal
 * this tool produces, so this stays conservative: no false negatives on
 * added host permissions.
 */

import type { ExtensionSnapshot, PermissionChange } from "../shared/types";
import { isBroadHostPermission } from "./hostPatterns";

function added(previous: string[], current: string[]): string[] {
  const previousSet = new Set(previous);
  return current.filter((entry) => !previousSet.has(entry));
}

export function diffSnapshots(
  previous: ExtensionSnapshot | undefined,
  current: ExtensionSnapshot,
): PermissionChange | null {
  if (!previous) return null; // nothing to compare against yet

  const addedPermissions = added(previous.permissions, current.permissions);
  const addedHostPermissions = added(previous.hostPermissions, current.hostPermissions);

  const versionChanged = current.version !== previous.version;
  const grew = addedPermissions.length > 0 || addedHostPermissions.length > 0;
  const newlyBroadHostAccess = addedHostPermissions.some(isBroadHostPermission);

  if (!((versionChanged && grew) || newlyBroadHostAccess)) {
    return null;
  }

  return {
    extensionId: current.id,
    extensionName: current.name,
    addedPermissions,
    addedHostPermissions,
    previousVersion: previous.version,
    newVersion: current.version,
    detectedAt: Date.now(),
  };
}
