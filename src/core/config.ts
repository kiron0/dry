import * as vscode from "vscode";

import type { DryConfig } from "./types";

const defaultExcludeGlob = "{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.next/**}";
const minSupportedLines = 3;
const maxSupportedLines = 60;

export const defaultDryConfig: DryConfig = {
  minLines: 4,
  maxLines: 12,
  enableNormalizedDetection: true,
  excludeGlob: defaultExcludeGlob,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeDryConfig(input: Partial<DryConfig>): DryConfig {
  const minLines = clamp(
    Math.trunc(input.minLines ?? defaultDryConfig.minLines),
    minSupportedLines,
    20,
  );
  const maxLines = clamp(
    Math.trunc(input.maxLines ?? defaultDryConfig.maxLines),
    minLines,
    maxSupportedLines,
  );

  return {
    minLines,
    maxLines,
    enableNormalizedDetection:
      typeof input.enableNormalizedDetection === "boolean"
        ? input.enableNormalizedDetection
        : defaultDryConfig.enableNormalizedDetection,
    excludeGlob:
      typeof input.excludeGlob === "string" && input.excludeGlob.trim().length > 0
        ? input.excludeGlob.trim()
        : defaultDryConfig.excludeGlob,
  };
}

export function getDryConfig(): DryConfig {
  const cfg = vscode.workspace.getConfiguration("dry");
  return normalizeDryConfig({
    minLines: cfg.get<number>("minLines", defaultDryConfig.minLines),
    maxLines: cfg.get<number>("maxLines", defaultDryConfig.maxLines),
    enableNormalizedDetection: cfg.get<boolean>(
      "enableNormalizedDetection",
      defaultDryConfig.enableNormalizedDetection,
    ),
    excludeGlob: cfg.get<string>("excludeGlob", defaultDryConfig.excludeGlob),
  });
}

export async function updateDryConfig(
  nextConfig: DryConfig,
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace,
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration("dry");
  const normalized = normalizeDryConfig(nextConfig);

  await cfg.update("minLines", normalized.minLines, target);
  await cfg.update("maxLines", normalized.maxLines, target);
  await cfg.update("enableNormalizedDetection", normalized.enableNormalizedDetection, target);
  await cfg.update("excludeGlob", normalized.excludeGlob, target);
}
