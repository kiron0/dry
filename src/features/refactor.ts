import * as vscode from "vscode";
import * as path from "node:path";

import { dedentBlock, indentBlock, simpleHash } from "../core/normalize";
import type { DuplicateCluster, DuplicateOccurrence } from "../core/types";

function isExactCluster(cluster: DuplicateCluster): boolean {
  return cluster.kind === "exact";
}

function compareByReverseRange(a: DuplicateOccurrence, b: DuplicateOccurrence): number {
  if (a.startLine !== b.startLine) {
    return b.startLine - a.startLine;
  }

  return b.endLine - a.endLine;
}

function computeIndent(document: vscode.TextDocument, line: number): string {
  const text = document.lineAt(line).text;
  const matched = text.match(/^\s*/);
  return matched ? matched[0] : "";
}

function pickFunctionName(document: vscode.TextDocument, baseName: string): string {
  let name = baseName;
  let index = 1;

  while (document.getText().includes(`function ${name}`) || document.getText().includes(`const ${name} =`)) {
    name = `${baseName}${index}`;
    index += 1;
  }

  return name;
}

function collectOccurrencesInFile(cluster: DuplicateCluster, uri: vscode.Uri): DuplicateOccurrence[] {
  return cluster.occurrences.filter((occurrence) => occurrence.uri.toString() === uri.toString());
}

function getOrCreateOccurrences(
  map: Map<string, DuplicateOccurrence[]>,
  key: string,
): DuplicateOccurrence[] {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const created: DuplicateOccurrence[] = [];
  map.set(key, created);
  return created;
}

async function ensureUtilFileUri(baseUri: vscode.Uri): Promise<vscode.Uri> {
  const folder = vscode.workspace.getWorkspaceFolder(baseUri);
  if (!folder) {
    throw new Error("Open a workspace folder to use Move to Shared Util.");
  }

  const srcUri = vscode.Uri.joinPath(folder.uri, "src");
  let targetDirectory = vscode.Uri.joinPath(folder.uri, "utils");

  try {
    await vscode.workspace.fs.stat(srcUri);
    targetDirectory = vscode.Uri.joinPath(srcUri, "utils");
  } catch {
    // src folder missing; keep workspace-level utils folder.
  }

  try {
    await vscode.workspace.fs.stat(targetDirectory);
  } catch {
    await vscode.workspace.fs.createDirectory(targetDirectory);
  }

  return vscode.Uri.joinPath(targetDirectory, "dry.ts");
}

function toImportPath(from: vscode.Uri, to: vscode.Uri): string {
  const fromDir = path.posix.dirname(from.path);
  const rel = path.posix.relative(fromDir, to.path).replace(/\.(tsx?|jsx?)$/i, "");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function findImportInsertOffset(documentText: string): number {
  const importRegex = /^\s*import\s.+?;\s*$/gm;
  let offset = 0;

  let match = importRegex.exec(documentText);
  while (match) {
    offset = match.index + match[0].length;
    match = importRegex.exec(documentText);
  }

  return offset;
}

export class DryRefactorService {
  async extractToFunction(cluster: DuplicateCluster, anchorUri: vscode.Uri): Promise<void> {
    if (!isExactCluster(cluster)) {
      vscode.window.showInformationMessage("Extraction quick fix is available only for exact duplicates.");
      return;
    }

    const fileOccurrences = collectOccurrencesInFile(cluster, anchorUri);
    if (fileOccurrences.length < 2) {
      vscode.window.showInformationMessage("Need at least two exact duplicates in the same file to extract.");
      return;
    }

    const document = await vscode.workspace.openTextDocument(anchorUri);
    const firstOccurrence = fileOccurrences[0];
    if (!firstOccurrence) {
      return;
    }

    const block = dedentBlock(firstOccurrence.text);
    const functionName = pickFunctionName(document, "extractedDryBlock");

    const functionBody = `\nfunction ${functionName}(): void {\n${indentBlock(block, "  ")}\n}\n`;

    const edit = new vscode.WorkspaceEdit();

    for (const occurrence of [...fileOccurrences].sort(compareByReverseRange)) {
      const indent = computeIndent(document, occurrence.startLine);
      edit.replace(anchorUri, occurrence.range, `${indent}${functionName}();`);
    }

    const eof = document.positionAt(document.getText().length);
    edit.insert(anchorUri, eof, `\n${functionBody}`);

    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      throw new Error("Unable to apply extract-to-function edit.");
    }

    vscode.window.showInformationMessage(
      `DRY: Extracted ${fileOccurrences.length} duplicate blocks to function ${functionName}().`,
    );
  }

  async moveToSharedUtil(cluster: DuplicateCluster): Promise<void> {
    if (!isExactCluster(cluster)) {
      vscode.window.showInformationMessage("Move to shared util is available only for exact duplicates.");
      return;
    }

    const first = cluster.occurrences[0];
    if (!first) {
      return;
    }

    const utilUri = await ensureUtilFileUri(first.uri);
    const utilName = `dryBlock${simpleHash(cluster.id)}`;
    const block = dedentBlock(first.text);

    let utilExists = true;
    let utilDocument: vscode.TextDocument | undefined;
    try {
      utilDocument = await vscode.workspace.openTextDocument(utilUri);
    } catch {
      utilExists = false;
    }

    const utilSnippet = `\nexport function ${utilName}(): void {\n${indentBlock(block, "  ")}\n}\n`;
    const edit = new vscode.WorkspaceEdit();

    if (!utilExists) {
      edit.createFile(utilUri, { ignoreIfExists: true });
      edit.insert(utilUri, new vscode.Position(0, 0), `// Generated by DRY\n${utilSnippet}`);
    } else {
      if (utilDocument && !utilDocument.getText().includes(`export function ${utilName}(`)) {
        const utilEof = utilDocument.positionAt(utilDocument.getText().length);
        edit.insert(utilUri, utilEof, utilSnippet);
      }
    }

    const occurrencesByFile = new Map<string, DuplicateOccurrence[]>();
    for (const occurrence of cluster.occurrences) {
      const key = occurrence.uri.toString();
      const bucket = getOrCreateOccurrences(occurrencesByFile, key);
      bucket.push(occurrence);
    }

    for (const [fileKey, occurrences] of occurrencesByFile.entries()) {
      const firstOccurrence = occurrences[0];
      if (!firstOccurrence) {
        continue;
      }

      const uri = firstOccurrence.uri;
      const document = await vscode.workspace.openTextDocument(uri);

      for (const occurrence of [...occurrences].sort(compareByReverseRange)) {
        const indent = computeIndent(document, occurrence.startLine);
        edit.replace(uri, occurrence.range, `${indent}${utilName}();`);
      }

      if (fileKey === utilUri.toString()) {
        continue;
      }

      const importStatement = `import { ${utilName} } from "${toImportPath(uri, utilUri)}";\n`;
      if (!document.getText().includes(importStatement.trim())) {
        const offset = findImportInsertOffset(document.getText());
        const pos = document.positionAt(offset);
        edit.insert(uri, pos, offset > 0 ? `\n${importStatement}` : `${importStatement}\n`);
      }
    }

    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      throw new Error("Unable to apply move-to-shared-util edit.");
    }

    vscode.window.showInformationMessage(
      `DRY: Moved ${cluster.occurrences.length} duplicate blocks to shared util ${utilName}().`,
    );
  }
}
