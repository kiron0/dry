import * as vscode from "vscode";

import { defaultDryConfig, getDryConfig, updateDryConfig } from "./core/config";
import { DuplicateScanner } from "./core/scanner";
import type { DryReport, DuplicateCluster, DuplicateOccurrence } from "./core/types";
import { DryCodeActionProvider } from "./features/code-actions";
import { DryRefactorService } from "./features/refactor";
import { DryReportProvider } from "./ui/report";
import { registerSettingsUiCommand } from "./ui/settings-webview";
import { DryStatusBarController } from "./ui/status-bar";

function getOrCreateDiagnosticBucket(
  map: Map<string, { uri: vscode.Uri; diagnostics: vscode.Diagnostic[] }>,
  key: string,
  uri: vscode.Uri,
): { uri: vscode.Uri; diagnostics: vscode.Diagnostic[] } {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const created = { uri, diagnostics: [] as vscode.Diagnostic[] };
  map.set(key, created);
  return created;
}

function buildRelatedInfo(
  cluster: DuplicateCluster,
  target: DuplicateOccurrence,
): vscode.DiagnosticRelatedInformation[] {
  return cluster.occurrences
    .filter((occurrence) => occurrence.uri.toString() !== target.uri.toString() || occurrence.startLine !== target.startLine)
    .slice(0, 6)
    .map(
      (occurrence) =>
        new vscode.DiagnosticRelatedInformation(
          new vscode.Location(occurrence.uri, occurrence.range),
          `Related duplicate (${vscode.workspace.asRelativePath(occurrence.uri, false)}:${occurrence.startLine + 1})`,
        ),
    );
}

function publishDiagnostics(collection: vscode.DiagnosticCollection, report: DryReport): void {
  const byUri = new Map<string, { uri: vscode.Uri; diagnostics: vscode.Diagnostic[] }>();

  for (const cluster of report.clusters) {
    for (const occurrence of cluster.occurrences) {
      const key = occurrence.uri.toString();
      const bucket = getOrCreateDiagnosticBucket(byUri, key, occurrence.uri);

      const severity = cluster.kind === "exact" ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
      const diagnostic = new vscode.Diagnostic(
        occurrence.range,
        `Duplicate ${cluster.kind} block detected (${cluster.occurrences.length} occurrences, ${cluster.lineSpan} lines).`,
        severity,
      );
      diagnostic.source = "dry";
      diagnostic.code = cluster.id;
      diagnostic.relatedInformation = buildRelatedInfo(cluster, occurrence);
      bucket.diagnostics.push(diagnostic);
    }
  }

  collection.clear();
  for (const value of byUri.values()) {
    collection.set(value.uri, value.diagnostics);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection("dry");
  const scanner = new DuplicateScanner(() => getDryConfig());
  const refactor = new DryRefactorService();
  const reportProvider = new DryReportProvider();
  const statusBar = new DryStatusBarController();

  const treeView = vscode.window.createTreeView("dry.reportView", {
    treeDataProvider: reportProvider,
    showCollapseAll: true,
  });

  let refreshTimer: NodeJS.Timeout | undefined;
  const scheduleScan = (): void => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    refreshTimer = setTimeout(() => {
      void runScan();
    }, 450);
  };

  const runScan = async (showToast = false): Promise<void> => {
    try {
      const config = getDryConfig();
      const report = await scanner.scanWorkspace();
      publishDiagnostics(diagnostics, report);
      reportProvider.update(report);
      statusBar.update(report, config);

      if (showToast) {
        vscode.window.showInformationMessage(
          `DRY scan complete: score ${report.projectScore}/100, ${report.clusters.length} clusters.`,
        );
      }
    } catch (error) {
      console.error("DRY scan failed", error);
      vscode.window.showErrorMessage("DRY scan failed. Check the console for details.");
    }
  };

  const commandScan = vscode.commands.registerCommand("dry.scanWorkspace", async () => {
    await runScan(true);
  });

  const commandOpenOccurrence = vscode.commands.registerCommand(
    "dry.openOccurrence",
    async (uri: vscode.Uri, range: vscode.Range) => {
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document, { preview: false });
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    },
  );

  const commandExtract = vscode.commands.registerCommand(
    "dry.extractToFunction",
    async (clusterId: string, anchorUri?: vscode.Uri) => {
      const cluster = scanner.getClusterById(clusterId);
      if (!cluster) {
        vscode.window.showWarningMessage("DRY: cluster not found. Run scan again.");
        return;
      }

      const uri = anchorUri ?? vscode.window.activeTextEditor?.document.uri;
      if (!uri) {
        vscode.window.showWarningMessage("DRY: open a file with duplicate diagnostics first.");
        return;
      }

      await refactor.extractToFunction(cluster, uri);
      await runScan();
    },
  );

  const commandMove = vscode.commands.registerCommand("dry.moveToSharedUtil", async (clusterId: string) => {
    const cluster = scanner.getClusterById(clusterId);
    if (!cluster) {
      vscode.window.showWarningMessage("DRY: cluster not found. Run scan again.");
      return;
    }

    await refactor.moveToSharedUtil(cluster);
    await runScan();
  });

  const commandResetSettings = vscode.commands.registerCommand("dry.resetSettings", async () => {
    await updateDryConfig(defaultDryConfig);
    await runScan(true);
    vscode.window.showInformationMessage("DRY settings reset to defaults.");
  });

  const commandQuickOptions = vscode.commands.registerCommand("dry.quickOptions", async () => {
    const current = getDryConfig();
    const normalizedState = current.enableNormalizedDetection ? "On" : "Off";

    const choice = await vscode.window.showQuickPick(
      [
        { label: "Open Settings UI", value: "open-settings" },
        { label: "Scan Workspace Now", value: "scan-workspace" },
        {
          label: `Toggle Normalized Detection (${normalizedState})`,
          value: "toggle-normalized",
        },
        { label: "Reset Settings to Defaults", value: "reset-settings" },
      ],
      {
        title: "DRY Quick Options",
        placeHolder: "Choose an action",
      },
    );

    if (!choice) {
      return;
    }

    if (choice.value === "open-settings") {
      await vscode.commands.executeCommand("dry.openSettingsUI");
      return;
    }

    if (choice.value === "scan-workspace") {
      await runScan(true);
      return;
    }

    if (choice.value === "toggle-normalized") {
      const next = {
        ...current,
        enableNormalizedDetection: !current.enableNormalizedDetection,
      };
      await updateDryConfig(next);
      await runScan(true);
      vscode.window.showInformationMessage(
        `DRY normalized detection ${next.enableNormalizedDetection ? "enabled" : "disabled"}.`,
      );
      return;
    }

    if (choice.value === "reset-settings") {
      await vscode.commands.executeCommand("dry.resetSettings");
    }
  });

  const settingsUi = registerSettingsUiCommand(
    context,
    () => getDryConfig(),
    async (settings) => {
      await updateDryConfig(settings);
      await runScan();
    },
    async (settings) => {
      await updateDryConfig(settings);
      await runScan(true);
    },
  );

  const codeActions = vscode.languages.registerCodeActionsProvider(
    [
      { language: "javascript", scheme: "file" },
      { language: "javascriptreact", scheme: "file" },
      { language: "typescript", scheme: "file" },
      { language: "typescriptreact", scheme: "file" },
    ],
    new DryCodeActionProvider(scanner),
    {
      providedCodeActionKinds: DryCodeActionProvider.providedCodeActionKinds,
    },
  );

  const subscriptions: vscode.Disposable[] = [
    diagnostics,
    scanner,
    reportProvider,
    statusBar,
    treeView,
    commandScan,
    commandOpenOccurrence,
    commandExtract,
    commandMove,
    commandResetSettings,
    commandQuickOptions,
    settingsUi,
    codeActions,
    vscode.workspace.onDidChangeTextDocument(() => scheduleScan()),
    vscode.workspace.onDidOpenTextDocument(() => scheduleScan()),
    vscode.workspace.onDidSaveTextDocument(() => scheduleScan()),
    vscode.workspace.onDidDeleteFiles(() => scheduleScan()),
    vscode.workspace.onDidCreateFiles(() => scheduleScan()),
    vscode.workspace.onDidRenameFiles(() => scheduleScan()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("dry")) {
        scheduleScan();
      }
    }),
  ];

  context.subscriptions.push(...subscriptions);

  void runScan();
}

export function deactivate(): void {}
