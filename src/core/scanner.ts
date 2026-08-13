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
        // chrome.management.ExtensionInfo types installType as a plain
        // string union (`${ExtensionInstallType}`), but the shared
        // ExtensionSnapshot type declares it as the ExtensionInstallType
        // enum itself, which TS does not accept raw string literals for.
        // Cast at this one boundary point rather than editing the shared
        // contract unilaterally — see commit message / PR description.
        installType: extension.installType as ExtensionSnapshot["installType"],
        enabled: extension.enabled,
        // chrome.management.ExtensionInfo has NO manifestVersion field at
        // all (confirmed against @types/chrome — not just stale typings).
        // This isn't a type-only issue like installType above: the data
        // genuinely isn't available from this API. Hardcoding 3 here means
        // the MV2 scoring penalty in riskScorer.ts can never fire. Needs a
        // real decision, not a cast — see commit message / PR description.
        manifestVersion: 3,
        ...PLACEHOLDER_RISK,
      }),
    );
}
