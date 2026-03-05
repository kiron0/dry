import { beforeEach, describe, expect, it, vi } from "vitest";

const getValue = vi.fn();
const updateValue = vi.fn(async () => undefined);
const getConfiguration = vi.fn(() => ({
  get: getValue,
  update: updateValue,
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration,
  },
  ConfigurationTarget: {
    Workspace: "workspace",
  },
}));

describe("core/config", () => {
  beforeEach(() => {
    getValue.mockReset();
    updateValue.mockClear();
    getConfiguration.mockClear();
  });

  it("normalizes invalid values", async () => {
    const { normalizeDryConfig, defaultDryConfig } = await import("../../src/core/config");

    const normalized = normalizeDryConfig({
      minLines: 1,
      maxLines: 2,
      excludeGlob: " ",
    });

    expect(normalized.minLines).toBe(3);
    expect(normalized.maxLines).toBe(3);
    expect(normalized.enableNormalizedDetection).toBe(defaultDryConfig.enableNormalizedDetection);
    expect(normalized.excludeGlob).toBe(defaultDryConfig.excludeGlob);
  });

  it("reads config through vscode workspace settings", async () => {
    getValue.mockImplementation((key: string, fallback: unknown) => {
      if (key === "minLines") return 5;
      if (key === "maxLines") return 11;
      if (key === "enableNormalizedDetection") return false;
      if (key === "excludeGlob") return "{**/tmp/**}";
      return fallback;
    });

    const { getDryConfig } = await import("../../src/core/config");
    const cfg = getDryConfig();

    expect(cfg).toEqual({
      minLines: 5,
      maxLines: 11,
      enableNormalizedDetection: false,
      excludeGlob: "{**/tmp/**}",
    });
  });

  it("persists normalized config values", async () => {
    const { updateDryConfig } = await import("../../src/core/config");
    await updateDryConfig(
      {
        minLines: 2,
        maxLines: 1,
        enableNormalizedDetection: true,
        excludeGlob: "",
      },
      "workspace" as never,
    );

    expect(updateValue).toHaveBeenNthCalledWith(1, "minLines", 3, "workspace");
    expect(updateValue).toHaveBeenNthCalledWith(2, "maxLines", 3, "workspace");
    expect(updateValue).toHaveBeenNthCalledWith(
      3,
      "enableNormalizedDetection",
      true,
      "workspace",
    );
    expect(updateValue).toHaveBeenNthCalledWith(
      4,
      "excludeGlob",
      "{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.next/**}",
      "workspace",
    );
  });
});
