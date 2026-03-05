<div align="center">
  <img src="media/dry.png" alt="DRY Icon" width="140" />

  # DRY

  ### Duplicate Detection + Refactor Assistant for VS Code

  Catch repeated code while you write, then refactor it in one click.

  <p>
    <img src="https://img.shields.io/badge/VS%20Code-1.109.0%2B-0ea5e9?style=for-the-badge&logo=visualstudiocode&logoColor=white" />
    <img src="https://img.shields.io/badge/License-MIT-16a34a?style=for-the-badge" />
  </p>
</div>

---

## Overview

**DRY** is a VS Code extension that scans your workspace for duplicate or near-duplicate code blocks across JS/TS files.

It raises duplicates as native diagnostics in the editor and Problems panel, then offers Quick Fix actions to extract repetition into reusable code.

If copy-paste creeps in, DRY shows where it is and helps you clean it up fast.

---

## Features

- Duplicate block detection across `.js`, `.jsx`, `.ts`, `.tsx`
- Exact duplicate matching
- Normalized structure matching (ignores comments, literals, and identifier names)
- Problems panel diagnostics with related duplicate links
- Status bar DRY indicator (click opens Quick Options)
- Quick Fix actions:
  - `DRY: Extract duplicate to function` for same-file exact duplicates
  - `DRY: Move duplicate to shared util` for cross-file exact duplicates
- Sidebar `DRY Report` with:
  - Project DRY score
  - Top duplicate clusters
  - Duplication hotspots by file

---

## Commands

Open Command Palette and run:

- `DRY: Scan Workspace for Duplicates`
- `DRY: Extract Duplicate to Function`
- `DRY: Move Duplicate to Shared Util`
- `DRY: Open Settings UI`
- `DRY: Quick Options`
- `DRY: Reset Settings`

---

## Configuration

DRY settings are available in VS Code Settings:

- `dry.minLines` - Minimum block size to consider as duplicate
- `dry.maxLines` - Maximum block size scanned per window
- `dry.enableNormalizedDetection` - Enable near-duplicate structural matching
- `dry.excludeGlob` - Files/folders excluded from scan

---

## Use Case

DRY is useful when you:

- Copy fetch/validation/error-handling logic across files
- Repeat similar JSX sections with small prop/text changes
- Duplicate utility logic in multiple modules
- Want abstraction opportunities surfaced before CI or review

---

Press `F5` in VS Code to run the extension in Extension Development Host.

---

## Notes

- Refactor quick fixes are intentionally conservative in MVP.
- Auto-refactor is enabled only for exact duplicate clusters.
- Normalized clusters are reported for awareness and manual follow-up.
- Settings UI includes quick actions for save, reset defaults, and instant scan.

---

## License

MIT License © Toufiq Hasan Kiron
