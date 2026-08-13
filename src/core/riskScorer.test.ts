import { describe, expect, it } from "vitest";
import { scoreRisk } from "./riskScorer";

describe("scoreRisk", () => {
  it("scores a low-risk extension", () => {
    const { riskScore, riskTier } = scoreRisk(["storage", "alarms"], [], "normal", 3);
    expect(riskScore).toBe(2);
    expect(riskTier).toBe("low");
  });

  it("scores a critical-risk extension with <all_urls>", () => {
    const { riskScore, riskTier } = scoreRisk(
      ["management", "debugger", "proxy"],
      ["<all_urls>"],
      "normal",
      3,
    );
    expect(riskScore).toBe(40); // 10 + 10 + 10 + 10 (broad host)
    expect(riskTier).toBe("critical");
  });

  it("scores scripting + activeTab alone as low risk", () => {
    const { riskScore, riskTier } = scoreRisk(["scripting", "activeTab"], [], "normal", 3);
    expect(riskScore).toBe(2); // scripting (narrow, 1) + activeTab (1)
    expect(riskTier).toBe("low");
  });

  it("scores scripting paired with a broad host permission as high-risk", () => {
    const { riskScore } = scoreRisk(["scripting"], ["<all_urls>"], "normal", 3);
    expect(riskScore).toBe(17); // scripting (broad, 7) + broad host (10)
  });

  it("multiplies the score for non-Web-Store install types", () => {
    const { riskScore, riskTier } = scoreRisk(["tabs"], [], "development", 3);
    expect(riskScore).toBe(10.5); // tabs (7) * 1.5
    expect(riskTier).toBe("medium");
  });

  it("does not penalize admin (org-managed) installs", () => {
    const { riskScore } = scoreRisk(["tabs"], [], "admin", 3);
    expect(riskScore).toBe(7);
  });

  it("applies a flat penalty for Manifest V2", () => {
    const { riskScore } = scoreRisk([], [], "normal", 2);
    expect(riskScore).toBe(5);
  });
});
