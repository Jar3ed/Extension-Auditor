/**
 * Shared check for "broad" host permission patterns — used by both risk
 * scoring (broad host access is inherently high risk) and escalation
 * diffing (a newly granted broad host permission is flagged regardless of
 * version bump).
 */
export function isBroadHostPermission(pattern: string): boolean {
  return pattern === "<all_urls>" || pattern === "*://*/*";
}
