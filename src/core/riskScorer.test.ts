import { describe, expect, it } from "vitest";
import { scoreRisk } from "./riskScorer";

// Placeholder smoke test — confirms the test runner is wired up correctly.
// scoreRisk itself is not yet implemented (see TODO in riskScorer.ts), so
// this only checks that the module loads and exports the expected shape.
describe("riskScorer", () => {
  it("exports a scoreRisk function", () => {
    expect(typeof scoreRisk).toBe("function");
  });
});
