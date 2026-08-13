/**
 * Settings page root component.
 *
 * TODO: Expose a scan interval control (backed by chrome.alarms) that
 * reads/writes its value via src/core/storage.ts. Everything else here
 * is a placeholder until that (and future settings) land.
 */

export default function App() {
  return (
    <div className="max-w-md mx-auto p-6 text-sm">
      <h1 className="text-lg font-semibold">ExtSentinel Settings</h1>
      {/* TODO: scan interval control goes here */}
    </div>
  );
}
