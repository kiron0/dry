import { beforeEach, describe, expect, it, vi } from "vitest";

type MockUri = {
  path: string;
  toString: () => string;
};

class MockRange {
  constructor(
    public readonly startLine: number,
    public readonly startCharacter: number,
    public readonly endLine: number,
    public readonly endCharacter: number,
  ) {}

  intersection(other: MockRange): MockRange | undefined {
    const start = Math.max(this.startLine, other.startLine);
    const end = Math.min(this.endLine, other.endLine);
    if (start > end) {
      return undefined;
    }

    return this;
  }
}

class MockEventEmitter<T> {
  private listeners: Array<(value: T) => void> = [];

  public readonly event = (listener: (value: T) => void): { dispose: () => void } => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        this.listeners = this.listeners.filter((item) => item !== listener);
      },
    };
  };

  fire(value: T): void {
    for (const listener of this.listeners) {
      listener(value);
    }
  }

  dispose(): void {
    this.listeners = [];
  }
}

type MockDocument = {
  uri: MockUri;
  getText: () => string;
  lineAt: (line: number) => { text: string };
};

const fileMap = new Map<string, string>();

function uri(path: string): MockUri {
  return {
    path,
    toString: () => path,
  };
}

function makeDocument(fileUri: MockUri, text: string): MockDocument {
  const lines = text.split(/\r?\n/);
  return {
    uri: fileUri,
    getText: () => text,
    lineAt: (line: number) => ({ text: lines[line] ?? "" }),
  };
}

vi.mock("vscode", () => {
  return {
    Range: MockRange,
    EventEmitter: MockEventEmitter,
    workspace: {
      findFiles: vi.fn(async () => Array.from(fileMap.keys()).map((path) => uri(path))),
      openTextDocument: vi.fn(async (fileUri: MockUri) => {
        const source = fileMap.get(fileUri.toString());
        if (!source) {
          throw new Error(`Missing mock document for ${fileUri.toString()}`);
        }

        return makeDocument(fileUri, source);
      }),
    },
  };
});

describe("DuplicateScanner integration", () => {
  beforeEach(() => {
    fileMap.clear();
    vi.resetModules();
  });

  it("detects exact duplicates across files", async () => {
    fileMap.set(
      "/workspace/src/a.ts",
      `
const subtotal = items.reduce((sum, item) => sum + item.price, 0);
const tax = subtotal * 0.15;
console.log(subtotal + tax);
`,
    );
    fileMap.set(
      "/workspace/src/b.ts",
      `
const subtotal = items.reduce((sum, item) => sum + item.price, 0);
const tax = subtotal * 0.15;
console.log(subtotal + tax);
`,
    );

    const { DuplicateScanner } = await import("../../src/core/scanner");
    const scanner = new DuplicateScanner(() => ({
      minLines: 3,
      maxLines: 6,
      enableNormalizedDetection: true,
      excludeGlob: "",
    }));

    const report = await scanner.scanWorkspace();
    const exactCluster = report.clusters.find(
      (cluster) => cluster.kind === "exact" && cluster.occurrences.length >= 2,
    );

    expect(exactCluster).toBeDefined();
    expect(report.projectScore).toBeLessThan(100);
  });

  it("detects normalized duplicates with renamed identifiers", async () => {
    fileMap.set(
      "/workspace/src/a.ts",
      `
const customerTotal = orders.reduce((sum, order) => sum + order.amount, 0);
const serviceFee = customerTotal * 0.2;
console.log(customerTotal + serviceFee);
`,
    );
    fileMap.set(
      "/workspace/src/b.ts",
      `
const invoiceTotal = bills.reduce((acc, bill) => acc + bill.amount, 0);
const extraCharge = invoiceTotal * 0.2;
console.log(invoiceTotal + extraCharge);
`,
    );

    const { DuplicateScanner } = await import("../../src/core/scanner");
    const scanner = new DuplicateScanner(() => ({
      minLines: 3,
      maxLines: 6,
      enableNormalizedDetection: true,
      excludeGlob: "",
    }));

    const report = await scanner.scanWorkspace();
    const normalizedCluster = report.clusters.find((cluster) => cluster.kind === "normalized");

    expect(normalizedCluster).toBeDefined();
    expect(normalizedCluster?.occurrences.length).toBeGreaterThanOrEqual(2);
  });
});
