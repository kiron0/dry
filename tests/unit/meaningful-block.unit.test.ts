import { describe, expect, it } from "vitest";

import { isMeaningfulBlock } from "../../src/core/normalize";

describe("isMeaningfulBlock", () => {
  it("returns false for mostly empty snippets", () => {
    expect(isMeaningfulBlock(" \n  \n\t")).toBe(false);
    expect(isMeaningfulBlock("(){}")).toBe(false);
  });

  it("returns true for substantial code snippets", () => {
    const snippet = `
      const total = prices.reduce((sum, price) => sum + price, 0);
      return total > 100 ? "high" : "low";
    `;
    expect(isMeaningfulBlock(snippet)).toBe(true);
  });
});
