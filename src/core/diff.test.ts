import { describe, expect, it } from "vitest";
import { diffSnapshots } from "./diff";
import type { ExtensionSnapshot } from "../shared/types";

function makeSnapshot(overrides: Partial<ExtensionSnapshot> = {}): ExtensionSnapshot {
  return {
    id: "ext-1",
    name: "Test Extension",
    version: "1.0.0",
    permissions: ["storage"],
    hostPermissions: [],
    installType: "normal" as ExtensionSnapshot["installType"],
    enabled: true,
    manifestVersion: 3,
    riskScore: 1,
    riskTier: "low",
    ...overrides,
  };
}

describe("diffSnapshots", () => {
  it("returns null when there is no previous snapshot", () => {
    expect(diffSnapshots(undefined, makeSnapshot())).toBeNull();
  });

  it("does not flag a version bump with no permission change", () => {
    const previous = makeSnapshot({ version: "1.0.0" });
    const current = makeSnapshot({ version: "1.1.0" });
    expect(diffSnapshots(previous, current)).toBeNull();
  });

  it("flags a version bump with a new host permission", () => {
    const previous = makeSnapshot({ version: "1.0.0", hostPermissions: [] });
    const current = makeSnapshot({
      version: "1.1.0",
      hostPermissions: ["https://example.com/*"],
    });
    const change = diffSnapshots(previous, current);
    expect(change).not.toBeNull();
    expect(change?.addedHostPermissions).toEqual(["https://example.com/*"]);
    expect(change?.previousVersion).toBe("1.0.0");
    expect(change?.newVersion).toBe("1.1.0");
  });

  it("does not flag permission growth without a version change", () => {
    const previous = makeSnapshot({ permissions: ["storage"] });
    const current = makeSnapshot({ permissions: ["storage", "tabs"] });
    expect(diffSnapshots(previous, current)).toBeNull();
  });

  it("flags a newly broad host permission even without a version change", () => {
    const previous = makeSnapshot({ hostPermissions: [] });
    const current = makeSnapshot({ hostPermissions: ["<all_urls>"] });
    const change = diffSnapshots(previous, current);
    expect(change).not.toBeNull();
    expect(change?.addedHostPermissions).toEqual(["<all_urls>"]);
  });
});
