import { describe, expect, it } from "vitest";

import { simpleHash } from "../../src/core/normalize";

describe("simpleHash", () => {
  it("is deterministic for same input", () => {
    const input = "const foo = bar + 1;";
    expect(simpleHash(input)).toBe(simpleHash(input));
  });

  it("produces different hashes for different inputs", () => {
    const a = simpleHash("alpha");
    const b = simpleHash("beta");
    expect(a).not.toBe(b);
  });
});
