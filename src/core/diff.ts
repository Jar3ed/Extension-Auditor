/**
 * Permission-escalation detection.
 *
 * TODO: Compare a newly scanned ExtensionSnapshot against the previously
 * stored snapshot for the same extension id. If permissions or
 * hostPermissions grew, or the version changed with new grants, emit a
 * PermissionChange record.
 * TODO: This is the core of the supply-chain-attack detection feature —
 * keep it conservative (no false negatives on added host permissions).
 */

import type { ExtensionSnapshot, PermissionChange } from "../shared/types";

export function diffSnapshots(
  _previous: ExtensionSnapshot | undefined,
  _current: ExtensionSnapshot,
): PermissionChange | null {
  throw new Error("TODO: not implemented");
}
