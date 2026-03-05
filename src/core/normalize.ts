const literalPattern = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
const numberPattern = /\b\d+(?:\.\d+)?\b/g;
const identifierPattern = /\b[$A-Za-z_][$\w]*\b/g;

const reserved = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

export function normalizeForExact(block: string): string {
  return block
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function stripComments(value: string): string {
  const withoutBlock = value.replace(/\/\*[\s\S]*?\*\//g, " ");
  return withoutBlock
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|[^:\\])\/\/.*$/g, "$1"))
    .join("\n");
}

export function normalizeForStructure(block: string): string {
  const noComments = stripComments(block);

  const normalized = noComments
    .replace(literalPattern, "__str__")
    .replace(numberPattern, "0")
    .replace(identifierPattern, (token) => (reserved.has(token) ? token : "__id__"))
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

export function isMeaningfulBlock(block: string): boolean {
  const cleaned = block.replace(/\s+/g, "");
  if (cleaned.length < 24) {
    return false;
  }

  return /[A-Za-z0-9_$]/.test(cleaned);
}

export function dedentBlock(block: string): string {
  const lines = block.split(/\r?\n/);

  while (lines.length > 0 && lines[0].trim().length === 0) {
    lines.shift();
  }

  while (lines.length > 0 && lines[lines.length - 1]?.trim().length === 0) {
    lines.pop();
  }

  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const matched = line.match(/^\s*/);
      return matched ? matched[0].length : 0;
    });

  const minIndent = indents.length === 0 ? 0 : Math.min(...indents);

  return lines.map((line) => line.slice(minIndent)).join("\n");
}

export function indentBlock(block: string, indent: string): string {
  return block
    .split(/\r?\n/)
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join("\n");
}

export function simpleHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}
