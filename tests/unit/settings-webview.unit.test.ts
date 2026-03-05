import { beforeEach, describe, expect, it, vi } from "vitest";

type Disposable = { dispose: () => void };

const noopDisposable = (): Disposable => ({ dispose: () => undefined });

let registeredCommand: ((...args: unknown[]) => Promise<void>) | undefined;
let onReceiveMessage: ((message: unknown) => Promise<void>) | undefined;

const postMessage = vi.fn();
const reveal = vi.fn();
const registerCommand = vi.fn((_: string, handler: (...args: unknown[]) => Promise<void>) => {
  registeredCommand = handler;
  return noopDisposable();
});
const createWebviewPanel = vi.fn(() => ({
  webview: {
    cspSource: "vscode-webview://dry",
    html: "",
    postMessage,
    onDidReceiveMessage: vi.fn((handler: (message: unknown) => Promise<void>) => {
      onReceiveMessage = handler;
      return noopDisposable();
    }),
  },
  reveal,
  onDidDispose: vi.fn(() => noopDisposable()),
}));

vi.mock("vscode", () => ({
  commands: { registerCommand },
  window: { createWebviewPanel },
  ViewColumn: { One: 1 },
}));

describe("settings webview", () => {
  beforeEach(() => {
    registeredCommand = undefined;
    onReceiveMessage = undefined;
    postMessage.mockClear();
    reveal.mockClear();
    registerCommand.mockClear();
    createWebviewPanel.mockClear();
  });

  it("registers open settings command and builds webview", async () => {
    const { registerSettingsUiCommand } = await import("../../src/ui/settings-webview");

    const getSettings = () => ({
      minLines: 4,
      maxLines: 12,
      enableNormalizedDetection: true,
      excludeGlob: "{**/node_modules/**}",
    });

    registerSettingsUiCommand({} as never, getSettings, vi.fn(async () => undefined), vi.fn(async () => undefined));
    expect(registerCommand).toHaveBeenCalledWith("dry.openSettingsUI", expect.any(Function));

    await registeredCommand?.();
    expect(createWebviewPanel).toHaveBeenCalledTimes(1);

    await registeredCommand?.();
    expect(createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it("handles save and scan messages", async () => {
    const { registerSettingsUiCommand } = await import("../../src/ui/settings-webview");
    const onSave = vi.fn(async () => undefined);
    const onScan = vi.fn(async () => undefined);

    registerSettingsUiCommand(
      {} as never,
      () => ({
        minLines: 4,
        maxLines: 12,
        enableNormalizedDetection: true,
        excludeGlob: "{**/node_modules/**}",
      }),
      onSave,
      onScan,
    );

    await registeredCommand?.();
    expect(onReceiveMessage).toBeDefined();

    await onReceiveMessage?.({
      type: "save",
      payload: { minLines: 1, maxLines: 2, enableNormalizedDetection: false, excludeGlob: " " },
    });
    expect(onSave).toHaveBeenCalledWith({
      minLines: 3,
      maxLines: 3,
      enableNormalizedDetection: false,
      excludeGlob: "{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.next/**}",
    });
    expect(postMessage).toHaveBeenCalledWith({
      type: "saved",
      payload: {
        minLines: 3,
        maxLines: 3,
        enableNormalizedDetection: false,
        excludeGlob: "{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.next/**}",
      },
    });

    await onReceiveMessage?.({
      type: "scan",
      payload: { minLines: 8, maxLines: 6, enableNormalizedDetection: true, excludeGlob: "{**/tmp/**}" },
    });
    expect(onScan).toHaveBeenCalledWith({
      minLines: 8,
      maxLines: 8,
      enableNormalizedDetection: true,
      excludeGlob: "{**/tmp/**}",
    });
    expect(postMessage).toHaveBeenCalledWith({ type: "scan-done" });
  });
});
