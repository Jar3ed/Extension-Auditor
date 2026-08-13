/**
 * Settings persisted to chrome.storage.local under a key of their own
 * (not part of ScanResult/messages.ts), shared between the options page
 * (which writes this) and the background worker (which reads it to
 * schedule the scan alarm).
 */

export const SCAN_INTERVAL_STORAGE_KEY = "scanIntervalMinutes";
export const DEFAULT_SCAN_INTERVAL_MINUTES = 60;
export const MIN_SCAN_INTERVAL_MINUTES = 30;
export const MAX_SCAN_INTERVAL_MINUTES = 360;
