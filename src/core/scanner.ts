import * as vscode from "vscode";

import { normalizeForExact, normalizeForStructure, isMeaningfulBlock, simpleHash } from "./normalize";
import type {
  DetectionKind,
  DryConfig,
  DryReport,
  DuplicateCluster,
  DuplicateOccurrence,
  FileDuplicationStat,
} from "./types";

type Candidate = {
  kind: DetectionKind;
  key: string;
  occurrence: DuplicateOccurrence;
};

function getOrCreateCandidateBucket(
  map: Map<string, Candidate[]>,
  key: string,
): Candidate[] {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const created: Candidate[] = [];
  map.set(key, created);
  return created;
}

function getOrCreateLineBucket(map: Map<string, Set<number>>, key: string): Set<number> {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const created = new Set<number>();
  map.set(key, created);
  return created;
}

function overlaps(a: DuplicateOccurrence, b: DuplicateOccurrence): boolean {
  if (a.uri.toString() !== b.uri.toString()) {
    return false;
  }

  return a.startLine <= b.endLine && b.startLine <= a.endLine;
}

function createRange(document: vscode.TextDocument, startLine: number, endLineInclusive: number): vscode.Range {
  const endText = document.lineAt(endLineInclusive).text;
  return new vscode.Range(startLine, 0, endLineInclusive, endText.length);
}

function buildCandidates(document: vscode.TextDocument, config: DryConfig): Candidate[] {
  const lines = document.getText().split(/\r?\n/);
  const maxLines = Math.min(config.maxLines, lines.length);
  const results: Candidate[] = [];

  for (let size = config.minLines; size <= maxLines; size += 1) {
    for (let start = 0; start + size <= lines.length; start += 1) {
      const end = start + size;
      const snippet = lines.slice(start, end).join("\n");
      if (!isMeaningfulBlock(snippet)) {
        continue;
      }

      const exactKey = normalizeForExact(snippet);
      if (exactKey.length === 0) {
        continue;
      }

      const occurrence: DuplicateOccurrence = {
        uri: document.uri,
        range: createRange(document, start, end - 1),
        startLine: start,
        endLine: end - 1,
        text: snippet,
      };

      results.push({ kind: "exact", key: exactKey, occurrence });

      if (config.enableNormalizedDetection) {
        const normalizedKey = normalizeForStructure(snippet);
        if (normalizedKey.length > 0 && normalizedKey !== exactKey) {
          results.push({ kind: "normalized", key: normalizedKey, occurrence });
        }
      }
    }
  }

  return results;
}

function dedupeOverlappingOccurrences(input: DuplicateOccurrence[]): DuplicateOccurrence[] {
  const sorted = [...input].sort((a, b) => {
    if (a.uri.toString() !== b.uri.toString()) {
      return a.uri.toString().localeCompare(b.uri.toString());
    }

    if (a.startLine !== b.startLine) {
      return a.startLine - b.startLine;
    }

    return b.endLine - a.endLine;
  });

  const kept: DuplicateOccurrence[] = [];
  for (const occurrence of sorted) {
    const hasOverlap = kept.some((existing) => overlaps(existing, occurrence));
    if (!hasOverlap) {
      kept.push(occurrence);
    }
  }

  return kept;
}

function computeProjectScore(totalDuplicatedLines: number, clusterCount: number): number {
  const penalty = Math.min(95, Math.round(totalDuplicatedLines * 0.8 + clusterCount * 2));
  return Math.max(5, 100 - penalty);
}

function computeFileStats(clusters: DuplicateCluster[]): FileDuplicationStat[] {
  const lineBuckets = new Map<string, Set<number>>();
  const clusterCountByFile = new Map<string, number>();
  const uriByKey = new Map<string, vscode.Uri>();

  for (const cluster of clusters) {
    const filesSeenForCluster = new Set<string>();

    for (const occurrence of cluster.occurrences) {
      const key = occurrence.uri.toString();
      uriByKey.set(key, occurrence.uri);
      const bucket = getOrCreateLineBucket(lineBuckets, key);
      for (let line = occurrence.startLine; line <= occurrence.endLine; line += 1) {
        bucket.add(line);
      }

      if (!filesSeenForCluster.has(key)) {
        filesSeenForCluster.add(key);
        clusterCountByFile.set(key, (clusterCountByFile.get(key) ?? 0) + 1);
      }
    }
  }

  const stats: FileDuplicationStat[] = [];
  for (const [key, lines] of lineBuckets.entries()) {
    const uri = uriByKey.get(key);
    if (!uri) continue;

    stats.push({
      uri,
      duplicatedLines: lines.size,
      clusterCount: clusterCountByFile.get(key) ?? 0,
    });
  }

  stats.sort((a, b) => b.duplicatedLines - a.duplicatedLines);
  return stats;
}

export class DuplicateScanner {
  private report: DryReport = {
    generatedAt: Date.now(),
    projectScore: 100,
    totalDuplicatedLines: 0,
    clusters: [],
    fileStats: [],
  };

  private readonly onDidUpdateReportEmitter = new vscode.EventEmitter<DryReport>();

  constructor(private readonly getConfig: () => DryConfig) {}

  public readonly onDidUpdateReport = this.onDidUpdateReportEmitter.event;

  getReport(): DryReport {
    return this.report;
  }

  getClusterById(clusterId: string): DuplicateCluster | undefined {
    return this.report.clusters.find((cluster) => cluster.id === clusterId);
  }

  findClusterAt(uri: vscode.Uri, range: vscode.Range): { cluster: DuplicateCluster; occurrence: DuplicateOccurrence } | undefined {
    for (const cluster of this.report.clusters) {
      for (const occurrence of cluster.occurrences) {
        if (occurrence.uri.toString() !== uri.toString()) {
          continue;
        }

        if (occurrence.range.intersection(range)) {
          return { cluster, occurrence };
        }
      }
    }

    return undefined;
  }

  async scanWorkspace(): Promise<DryReport> {
    const config = this.getConfig();
    const files = await vscode.workspace.findFiles("**/*.{js,jsx,ts,tsx}", config.excludeGlob);
    const grouped = new Map<string, Candidate[]>();

    for (const file of files) {
      const document = await vscode.workspace.openTextDocument(file);
      const candidates = buildCandidates(document, config);

      for (const candidate of candidates) {
        const key = `${candidate.kind}::${candidate.key}`;
        const bucket = getOrCreateCandidateBucket(grouped, key);
        bucket.push(candidate);
      }
    }

    const clusters: DuplicateCluster[] = [];

    for (const [bucketKey, candidates] of grouped.entries()) {
      if (candidates.length < 2) {
        continue;
      }

      const occurrences = dedupeOverlappingOccurrences(candidates.map((candidate) => candidate.occurrence));
      if (occurrences.length < 2) {
        continue;
      }

      const [kind] = bucketKey.split("::") as [DetectionKind];
      const lineSpan = occurrences[0] ? occurrences[0].endLine - occurrences[0].startLine + 1 : 0;
      const multiplier = kind === "exact" ? 1.2 : 1;
      const scoreImpact = Math.round(lineSpan * (occurrences.length - 1) * multiplier);
      const clusterId = `${kind}:${simpleHash(bucketKey)}`;

      clusters.push({
        id: clusterId,
        key: bucketKey,
        kind,
        occurrences,
        lineSpan,
        scoreImpact,
      });
    }

    clusters.sort((a, b) => b.scoreImpact - a.scoreImpact);

    const fileStats = computeFileStats(clusters);
    const totalDuplicatedLines = fileStats.reduce((sum, file) => sum + file.duplicatedLines, 0);
    const projectScore = computeProjectScore(totalDuplicatedLines, clusters.length);

    this.report = {
      generatedAt: Date.now(),
      projectScore,
      totalDuplicatedLines,
      clusters,
      fileStats,
    };

    this.onDidUpdateReportEmitter.fire(this.report);
    return this.report;
  }

  dispose(): void {
    this.onDidUpdateReportEmitter.dispose();
  }
}
