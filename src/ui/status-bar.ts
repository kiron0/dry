import * as vscode from "vscode";

import type { DryConfig, DryReport } from "../core/types";

export class DryStatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    this.item.command = "dry.quickOptions";
    this.item.text = "$(symbol-keyword) DRY";
    this.item.tooltip = "DRY quick options";
    this.item.show();
  }

  update(report: DryReport, config: DryConfig): void {
    const normalized = config.enableNormalizedDetection ? "On" : "Off";
    this.item.text = `$(symbol-keyword) DRY ${report.projectScore}`;
    this.item.tooltip =
      `DRY Score: ${report.projectScore}/100\n` +
      `Clusters: ${report.clusters.length}\n` +
      `Duplicated Lines: ${report.totalDuplicatedLines}\n` +
      `Normalized Detection: ${normalized}\n` +
      `Line Window: ${config.minLines}-${config.maxLines}\n\n` +
      "Click to open DRY Quick Options";
  }

  dispose(): void {
    this.item.dispose();
  }
}
