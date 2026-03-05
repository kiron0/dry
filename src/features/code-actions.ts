import * as vscode from "vscode";

import { DuplicateScanner } from "../core/scanner";

export class DryCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor(private readonly scanner: DuplicateScanner) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const dryDiagnostic = context.diagnostics.find((diagnostic) => diagnostic.source === "dry");
    if (!dryDiagnostic || typeof dryDiagnostic.code !== "string") {
      return [];
    }

    const clusterId = dryDiagnostic.code;
    const cluster = this.scanner.getClusterById(clusterId);
    if (!cluster || cluster.kind !== "exact") {
      return [];
    }

    const anchor = this.scanner.findClusterAt(document.uri, range);
    if (!anchor) {
      return [];
    }

    const extractAction = new vscode.CodeAction(
      "DRY: Extract duplicate to function",
      vscode.CodeActionKind.QuickFix,
    );
    extractAction.command = {
      command: "dry.extractToFunction",
      title: "Extract duplicate to function",
      arguments: [clusterId, document.uri],
    };
    extractAction.diagnostics = [dryDiagnostic];

    const moveAction = new vscode.CodeAction(
      "DRY: Move duplicate to shared util",
      vscode.CodeActionKind.QuickFix,
    );
    moveAction.command = {
      command: "dry.moveToSharedUtil",
      title: "Move duplicate to shared util",
      arguments: [clusterId],
    };
    moveAction.diagnostics = [dryDiagnostic];

    return [extractAction, moveAction];
  }
}
