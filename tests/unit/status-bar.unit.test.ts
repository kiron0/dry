import { describe, expect, it, vi } from "vitest";

const item = {
  text: "",
  tooltip: "",
  command: undefined as unknown,
  show: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("vscode", () => ({
  window: {
    createStatusBarItem: vi.fn(() => item),
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
}));

describe("status bar", () => {
  it("shows and updates score text", async () => {
    const { DryStatusBarController } = await import("../../src/ui/status-bar");
    const controller = new DryStatusBarController();

    controller.update(
      {
        generatedAt: Date.now(),
        projectScore: 88,
        totalDuplicatedLines: 34,
        clusters: [],
        fileStats: [],
      },
      {
        minLines: 4,
        maxLines: 12,
        enableNormalizedDetection: true,
        excludeGlob: "{**/node_modules/**}",
      },
    );

    expect(item.show).toHaveBeenCalled();
    expect(item.text).toContain("DRY 88");
    expect(String(item.tooltip)).toContain("Normalized Detection: On");

    controller.dispose();
    expect(item.dispose).toHaveBeenCalled();
  });
});
