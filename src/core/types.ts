import * as vscode from "vscode";

export type DetectionKind = "exact" | "normalized";

export type DuplicateOccurrence = {
  uri: vscode.Uri;
  range: vscode.Range;
  startLine: number;
  endLine: number;
  text: string;
};

export type DuplicateCluster = {
  id: string;
  key: string;
  kind: DetectionKind;
  occurrences: DuplicateOccurrence[];
  lineSpan: number;
  scoreImpact: number;
};

export type FileDuplicationStat = {
  uri: vscode.Uri;
  duplicatedLines: number;
  clusterCount: number;
};

export type DryReport = {
  generatedAt: number;
  projectScore: number;
  totalDuplicatedLines: number;
  clusters: DuplicateCluster[];
  fileStats: FileDuplicationStat[];
};

export type DryConfig = {
  minLines: number;
  maxLines: number;
  enableNormalizedDetection: boolean;
  excludeGlob: string;
};
