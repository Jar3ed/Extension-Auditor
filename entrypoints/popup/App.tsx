/**
 * Popup dashboard root component.
 *
 * TODO: On mount, send a GET_LATEST_SCAN message to the background
 * worker (fall back to TRIGGER_SCAN if there's no scan yet) and render
 * the resulting ScanResult: a list of ExtensionSnapshot cards (sorted by
 * riskTier) plus any recent PermissionChange alerts.
 * TODO: Break the rendering out into src/ui/components/** as it grows
 * (e.g. ExtensionCard, RiskBadge, ChangeAlert) — this file should stay a
 * thin container.
 */

export default function App() {
  return (
    <div className="w-80 p-4 text-sm">
      {/* TODO: replace with real dashboard UI */}
      <h1 className="text-base font-semibold">ExtSentinel</h1>
      <p className="text-gray-500">TODO: scan results go here.</p>
    </div>
  );
}
