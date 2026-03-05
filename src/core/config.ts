import * as vscode from "vscode";

import type { DryConfig } from "./types";

const defaultExcludeGlob = "{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.next/**}";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getDryConfig(): DryConfig {
  const cfg = vscode.workspace.getConfiguration("dry");
  const minLines = clamp(Math.trunc(cfg.get<number>("minLines", 4)), 3, 20);
  const maxLines = clamp(Math.trunc(cfg.get<number>("maxLines", 12)), minLines, 60);

  return {
    minLines,
    maxLines,
    enableNormalizedDetection: cfg.get<boolean>("enableNormalizedDetection", true),
    excludeGlob: cfg.get<string>("excludeGlob", defaultExcludeGlob) || defaultExcludeGlob,
  };
}
