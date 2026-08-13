/**
 * Scanning logic.
 *
 * Wraps chrome.management.getAll() and maps the result into
 * ExtensionSnapshot[], excluding this extension itself. riskScore/riskTier
 * are left as placeholders here — riskScorer.ts fills those in as a second
 * pass (see entrypoints/background.ts, which orchestrates scan -> diff ->
 * score -> save).
 */

import type { ExtensionSnapshot } from "../shared/types";

const PLACEHOLDER_RISK: Pick<ExtensionSnapshot, "riskScore" | "riskTier"> = {
  riskScore: 0,
  riskTier: "low",
};

export async function scanInstalledExtensions(): Promise<ExtensionSnapshot[]> {
  const [all, self] = await Promise.all([
    chrome.management.getAll(),
    chrome.management.getSelf(),
  ]);

  return all
    .filter((extension) => extension.id !== self.id)
    .map(
      (extension): ExtensionSnapshot => ({
        id: extension.id,
        name: extension.name,
        version: extension.version,
        permissions: extension.permissions,
        hostPermissions: extension.hostPermissions,
        installType: extension.installType,
        enabled: extension.enabled,
        ...PLACEHOLDER_RISK,
      }),
    );
}
