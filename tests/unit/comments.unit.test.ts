import { describe, expect, it } from "vitest";

import { stripComments } from "../../src/core/normalize";

describe("stripComments", () => {
  it("removes block and inline comments", () => {
    const source = `
      const a = 1; // remove me
      /* remove
         me */
      const b = 2;
    `;

    const result = stripComments(source);
    expect(result).toContain("const a = 1;");
    expect(result).toContain("const b = 2;");
    expect(result).not.toContain("remove me");
  });

  it("keeps protocol-like text untouched", () => {
    const source = `const endpoint = "https://api.example.com/v1";`;
    const result = stripComments(source);
    expect(result).toContain("https://api.example.com/v1");
  });
});
