/**
 * Fake ScanResult used to build/preview the dashboard before the real
 * background scanning logic exists. Shaped exactly like data that will
 * eventually come back from a GET_LATEST_SCAN / TRIGGER_SCAN response —
 * see src/ui/hooks/useExtensionScan.ts for where this gets swapped out.
 */

import type { ExtensionSnapshot, PermissionChange, ScanResult } from "../shared/types";

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

const extensions: ExtensionSnapshot[] = [
  {
    id: "aapocclcgogkmnckokdopfmhonfmgoek",
    name: "Simple Tab Groups",
    version: "3.2.1",
    permissions: ["storage"],
    hostPermissions: [],
    installType: chrome.management.ExtensionInstallType.NORMAL,
    enabled: true,
    riskScore: 8,
    riskTier: "low",
  },
  {
    id: "bbdgggpokdiogolkfiflelkmojjgdomo",
    name: "Grammar Helper",
    version: "5.0.4",
    permissions: ["storage", "contextMenus"],
    hostPermissions: ["*://*.grammarhelper.com/*"],
    installType: chrome.management.ExtensionInstallType.NORMAL,
    enabled: true,
    riskScore: 28,
    riskTier: "medium",
  },
  {
    id: "ccehimpgejnpjahdivjfpmpodkihmphc",
    name: "PriceTrackr — Deal Finder",
    version: "9.1.0",
    permissions: ["storage", "tabs", "webRequest", "cookies"],
    hostPermissions: ["<all_urls>"],
    installType: chrome.management.ExtensionInstallType.NORMAL,
    enabled: true,
    riskScore: 61,
    riskTier: "high",
  },
  {
    id: "ddfjkinpjcikamdmphncpblanhgnbmci",
    name: "Screenshot & Screen Recorder",
    version: "12.4.7",
    permissions: [
      "storage",
      "tabs",
      "webRequest",
      "webRequestBlocking",
      "proxy",
      "debugger",
    ],
    hostPermissions: ["<all_urls>"],
    installType: chrome.management.ExtensionInstallType.NORMAL,
    enabled: true,
    riskScore: 89,
    riskTier: "critical",
  },
  {
    id: "eefmjopqldkjfnfmpmmljmceahfegojk",
    name: "Old Unpacked Dev Tool",
    version: "0.9.0",
    permissions: ["storage", "management"],
    hostPermissions: [],
    installType: chrome.management.ExtensionInstallType.DEVELOPMENT,
    enabled: false,
    riskScore: 34,
    riskTier: "medium",
  },
];

const changes: PermissionChange[] = [
  {
    extensionId: "ddfjkinpjcikamdmphncpblanhgnbmci",
    extensionName: "Screenshot & Screen Recorder",
    addedPermissions: ["proxy", "debugger"],
    addedHostPermissions: ["<all_urls>"],
    previousVersion: "12.3.0",
    newVersion: "12.4.7",
    detectedAt: now - 1 * day,
  },
  {
    extensionId: "ccehimpgejnpjahdivjfpmpodkihmphc",
    extensionName: "PriceTrackr — Deal Finder",
    addedPermissions: ["webRequest", "cookies"],
    addedHostPermissions: ["<all_urls>"],
    previousVersion: "8.6.2",
    newVersion: "9.1.0",
    detectedAt: now - 9 * day,
  },
];

export const mockScanResult: ScanResult = {
  scannedAt: now,
  extensions,
  changes,
};
