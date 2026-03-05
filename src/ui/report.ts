import * as vscode from "vscode";

import type { DryReport, DuplicateCluster, FileDuplicationStat } from "../core/types";

type Node =
  | { type: "score"; label: string; description: string }
  | { type: "section"; label: string; key: "clusters" | "files" }
  | { type: "cluster"; cluster: DuplicateCluster }
  | { type: "file"; stat: FileDuplicationStat };

export class DryReportProvider implements vscode.TreeDataProvider<Node> {
  private report: DryReport = {
    generatedAt: Date.now(),
    projectScore: 100,
    totalDuplicatedLines: 0,
    clusters: [],
    fileStats: [],
  };

  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<Node | undefined | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  update(report: DryReport): void {
    this.report = report;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: Node): vscode.TreeItem {
    if (element.type === "score") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.description = element.description;
      item.iconPath = new vscode.ThemeIcon("graph");
      return item;
    }

    if (element.type === "section") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon(element.key === "clusters" ? "layers" : "file-directory");
      return item;
    }

    if (element.type === "cluster") {
      const item = new vscode.TreeItem(
        `${element.cluster.occurrences.length} occurrences - ${element.cluster.lineSpan} lines`,
        vscode.TreeItemCollapsibleState.None,
      );

      item.description = `${element.cluster.kind} | impact ${element.cluster.scoreImpact}`;
      item.iconPath = new vscode.ThemeIcon(element.cluster.kind === "exact" ? "warning" : "info");

      const first = element.cluster.occurrences[0];
      if (first) {
        item.command = {
          title: "Open occurrence",
          command: "dry.openOccurrence",
          arguments: [first.uri, first.range],
        };
      }

      return item;
    }

    const item = new vscode.TreeItem(
      vscode.workspace.asRelativePath(element.stat.uri, false),
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = `${element.stat.duplicatedLines} dup lines`;
    item.iconPath = new vscode.ThemeIcon("file");
    item.command = {
      title: "Open file",
      command: "vscode.open",
      arguments: [element.stat.uri],
    };
    return item;
  }

  getChildren(element?: Node): Node[] {
    if (!element) {
      return [
        {
          type: "score",
          label: `Project DRY Score: ${this.report.projectScore}/100`,
          description: `${this.report.totalDuplicatedLines} duplicated lines`,
        },
        { type: "section", label: "Top Duplicate Clusters", key: "clusters" },
        { type: "section", label: "Duplication Hotspots", key: "files" },
      ];
    }

    if (element.type === "section" && element.key === "clusters") {
      return this.report.clusters.slice(0, 12).map((cluster) => ({ type: "cluster", cluster }));
    }

    if (element.type === "section" && element.key === "files") {
      return this.report.fileStats.slice(0, 12).map((stat) => ({ type: "file", stat }));
    }

    return [];
  }

  dispose(): void {
    this.onDidChangeTreeDataEmitter.dispose();
  }
}
