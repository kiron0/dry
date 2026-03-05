import { describe, expect, it } from "vitest";

import {
  dedentBlock,
  indentBlock,
  normalizeForExact,
  normalizeForStructure,
  stripComments,
} from "../../src/core/normalize";

describe("normalize", () => {
  it("normalizes exact blocks by trimming trailing spaces", () => {
    const input = "const a = 1;   \nconst b = 2;   \n";
    expect(normalizeForExact(input)).toBe("const a = 1;\nconst b = 2;");
  });

  it("strips comments", () => {
    const input = "const a = 1; // inline\n/* block */\nconst b = 2;";
    expect(stripComments(input)).toContain("const a = 1;");
    expect(stripComments(input)).not.toContain("inline");
    expect(stripComments(input)).not.toContain("block");
  });

  it("normalizes structure by replacing literals and identifiers", () => {
    const a = "const userName = 'Jane';\nreturn userName.length + 10;";
    const b = "const profile = 'John';\nreturn profile.length + 99;";
    expect(normalizeForStructure(a)).toBe(normalizeForStructure(b));
  });

  it("dedents and indents blocks", () => {
    const source = "    if (ok) {\n      run();\n    }";
    const dedented = dedentBlock(source);
    expect(dedented).toBe("if (ok) {\n  run();\n}");
    expect(indentBlock(dedented, "  ")).toBe("  if (ok) {\n    run();\n  }");
  });
});
