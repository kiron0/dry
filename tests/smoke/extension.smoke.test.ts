import { beforeEach, describe, expect, it, vi } from "vitest";

type Disposable = { dispose: () => void };

const noopDisposable = (): Disposable => ({ dispose: () => undefined });

const commandHandlers = new Map<string, (...args: unknown[]) => unknown>();
const registerCommand = vi.fn((id: string, handler: (...args: unknown[]) => unknown) => {
  commandHandlers.set(id, handler);
  return noopDisposable();
});
const showInformationMessage = vi.fn();
const statusBarItem = {
  text: "",
  tooltip: "",
  command: undefined as unknown,
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn(),
};

const mockReport = {
  generatedAt: Date.now(),
  projectScore: 97,
  totalDuplicatedLines: 6,
  clusters: [],
  fileStats: [],
};

const scanWorkspace = vi.fn(async () => mockReport);
const updateReport = vi.fn();

vi.mock("vscode", () => ({
  window: {
    createTreeView: vi.fn(() => noopDisposable()),
    createStatusBarItem: vi.fn(() => statusBarItem),
    showInformationMessage,
    showWarningMessage: vi.fn(),
    showTextDocument: vi.fn(async () => ({
      selection: undefined,
      revealRange: vi.fn(),
    })),
    activeTextEditor: undefined,
  },
  workspace: {
    openTextDocument: vi.fn(async () => ({ uri: { toString: () => "/tmp/file.ts" } })),
    asRelativePath: vi.fn((uri: { toString: () => string }) => uri.toString()),
    onDidChangeTextDocument: vi.fn(() => noopDisposable()),
    onDidOpenTextDocument: vi.fn(() => noopDisposable()),
    onDidSaveTextDocument: vi.fn(() => noopDisposable()),
    onDidDeleteFiles: vi.fn(() => noopDisposable()),
    onDidCreateFiles: vi.fn(() => noopDisposable()),
    onDidRenameFiles: vi.fn(() => noopDisposable()),
    onDidChangeConfiguration: vi.fn(() => noopDisposable()),
  },
  commands: {
    registerCommand,
  },
  languages: {
    createDiagnosticCollection: vi.fn(() => ({
      clear: vi.fn(),
      set: vi.fn(),
      dispose: vi.fn(),
    })),
    registerCodeActionsProvider: vi.fn(() => noopDisposable()),
  },
  Selection: class Selection {
    constructor(
      public readonly start: unknown,
      public readonly end: unknown,
    ) {}
  },
  TextEditorRevealType: {
    InCenter: 0,
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
}));

vi.mock("../../src/core/config", () => ({
  getDryConfig: () => ({
    minLines: 4,
    maxLines: 12,
    enableNormalizedDetection: true,
    excludeGlob: "",
  }),
}));

vi.mock("../../src/core/scanner", () => ({
  DuplicateScanner: class DuplicateScanner {
    constructor(_: unknown) {}
    scanWorkspace = scanWorkspace;
    getClusterById = vi.fn();
    findClusterAt = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock("../../src/features/refactor", () => ({
  DryRefactorService: class DryRefactorService {
    extractToFunction = vi.fn(async () => undefined);
    moveToSharedUtil = vi.fn(async () => undefined);
  },
}));

vi.mock("../../src/ui/report", () => ({
  DryReportProvider: class DryReportProvider {
    update = updateReport;
    dispose = vi.fn();
    getChildren = vi.fn(() => []);
    getTreeItem = vi.fn();
  },
}));

vi.mock("../../src/features/code-actions", () => ({
  DryCodeActionProvider: class DryCodeActionProvider {
    static providedCodeActionKinds = ["quickfix"];
    constructor(_: unknown) {}
  },
}));

describe("extension smoke", () => {
  beforeEach(() => {
    commandHandlers.clear();
    registerCommand.mockClear();
    showInformationMessage.mockClear();
    scanWorkspace.mockClear();
    updateReport.mockClear();
    statusBarItem.show.mockClear();
    statusBarItem.dispose.mockClear();
  });

  it("activates and registers key commands", async () => {
    const { activate } = await import("../../src/extension");
    const context = { subscriptions: [] as Disposable[] };

    activate(context as unknown as { subscriptions: Disposable[] });

    expect(context.subscriptions.length).toBeGreaterThan(0);
    expect(registerCommand).toHaveBeenCalledWith("dry.scanWorkspace", expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith("dry.extractToFunction", expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith("dry.moveToSharedUtil", expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith("dry.openSettingsUI", expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith("dry.quickOptions", expect.any(Function));
    expect(registerCommand).toHaveBeenCalledWith("dry.resetSettings", expect.any(Function));
    await vi.waitFor(() => {
      expect(scanWorkspace).toHaveBeenCalled();
      expect(updateReport).toHaveBeenCalledWith(mockReport);
      expect(statusBarItem.show).toHaveBeenCalled();
    });
  });

  it("executes the scan command and emits toast", async () => {
    const { activate } = await import("../../src/extension");
    const context = { subscriptions: [] as Disposable[] };
    activate(context as unknown as { subscriptions: Disposable[] });

    const scanCommand = commandHandlers.get("dry.scanWorkspace");
    expect(scanCommand).toBeDefined();

    await scanCommand?.();

    expect(showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("DRY scan complete: score 97/100"),
    );
  });
});
