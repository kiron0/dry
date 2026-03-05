import * as vscode from "vscode";

import { defaultDryConfig, normalizeDryConfig } from "../core/config";
import type { DryConfig } from "../core/types";

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 32; i += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

function parseExcludeGlobToLines(glob: string): string[] {
  const trimmed = glob.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return trimmed.length > 0 ? [trimmed] : [];
}

function linesToExcludeGlob(lines: string[]): string {
  const clean = lines.map((line) => line.trim()).filter((line) => line.length > 0);
  if (clean.length === 0) {
    return defaultDryConfig.excludeGlob;
  }
  if (clean.length === 1) {
    return clean[0]!;
  }

  return `{${clean.join(",")}}`;
}

function renderSettingsWebview(webview: vscode.Webview, settings: DryConfig): string {
  const nonce = getNonce();
  const boot = JSON.stringify(settings).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <title>DRY Settings UI</title>
  <style>
    :root {
      --bg-a: #04101d;
      --bg-b: #031224;
      --panel: rgba(6, 16, 29, 0.92);
      --line: rgba(89, 112, 138, 0.35);
      --text: #ecf6ff;
      --muted: #93a9bf;
      --gold: #c2ad49;
      --cyan: #1fd4c2;
      --blue: #3aa0ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      background:
        radial-gradient(80rem 45rem at -20% -20%, rgba(58, 160, 255, 0.22), transparent 65%),
        radial-gradient(70rem 35rem at 120% 110%, rgba(31, 212, 194, 0.2), transparent 60%),
        linear-gradient(140deg, var(--bg-a), var(--bg-b));
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      min-height: 100vh;
      padding: 16px;
    }
    .shell {
      margin: 0 auto;
      width: min(980px, 100%);
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--panel);
      overflow: hidden;
    }
    .head {
      padding: 14px 20px;
      border-bottom: 1px solid var(--line);
      color: #9fc4e7;
      font-family: Consolas, monospace;
    }
    .body { padding: 22px; }
    h1 {
      margin: 0 0 18px;
      font-size: 2rem;
      color: #50b5ff;
      letter-spacing: 0.2px;
    }
    h1 span { color: #9ab4cb; font-size: 1.45rem; font-weight: 500; margin-left: 8px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
      background: rgba(7, 20, 35, 0.75);
    }
    .full { grid-column: 1 / -1; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .title { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .hint { margin: 8px 0 0; color: var(--muted); font-size: 0.96rem; line-height: 1.35; }
    .badge {
      color: #49c4ff;
      border: 1px solid rgba(58, 160, 255, 0.35);
      background: rgba(58, 160, 255, 0.12);
      border-radius: 8px;
      font-size: 0.82rem;
      padding: 3px 9px;
      font-family: Consolas, monospace;
    }
    .switch {
      width: 54px; height: 30px; border-radius: 999px;
      border: 1px solid rgba(194, 173, 73, 0.55);
      background: rgba(194, 173, 73, 0.22);
      position: relative; cursor: pointer;
    }
    .switch .dot {
      position: absolute; top: 3px; left: 3px;
      width: 22px; height: 22px; border-radius: 50%;
      background: #f5f5f5; transition: transform 140ms ease;
    }
    .switch.on .dot { transform: translateX(24px); }
    .range-line { margin-top: 8px; }
    input[type="range"] { width: 100%; accent-color: var(--cyan); }
    textarea {
      width: 100%;
      min-height: 132px;
      resize: vertical;
      background: rgba(2, 11, 21, 0.85);
      color: #c9def2;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 11px 12px;
      font-family: Consolas, monospace;
      font-size: 0.92rem;
      line-height: 1.45;
      margin-top: 10px;
    }
    .actions { margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap; }
    button {
      border: 1px solid transparent;
      border-radius: 10px;
      padding: 10px 14px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .save { color: #f4d867; background: rgba(194, 173, 73, 0.16); border-color: rgba(194, 173, 73, 0.4); }
    .reset { color: #95afc7; background: rgba(255, 255, 255, 0.03); border-color: rgba(148, 170, 195, 0.33); }
    .scan { color: #58b8ff; background: rgba(58, 160, 255, 0.12); border-color: rgba(58, 160, 255, 0.45); }
    .status { margin-left: auto; color: var(--muted); font-size: 0.9rem; }
    @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="shell">
    <div class="head">DRY: Settings UI</div>
    <div class="body">
      <h1>DRY <span>Settings Dashboard</span></h1>
      <div class="grid">
        <section class="card">
          <div class="row">
            <p class="title">Enable Normalized Detection</p>
            <button id="toggleNormalized" type="button" class="switch"><span class="dot"></span></button>
          </div>
          <p class="hint">Detect near-duplicates by normalizing comments, literals, and identifiers</p>
        </section>
        <section class="card">
          <div class="row"><p class="title">Min Lines</p><span id="minLinesValue" class="badge"></span></div>
          <div class="range-line"><input id="minLines" type="range" min="3" max="20" step="1" /></div>
          <p class="hint">Minimum block size to consider as duplicate</p>
        </section>
        <section class="card">
          <div class="row"><p class="title">Max Lines</p><span id="maxLinesValue" class="badge"></span></div>
          <div class="range-line"><input id="maxLines" type="range" min="4" max="60" step="1" /></div>
          <p class="hint">Maximum block size scanned per window</p>
        </section>
        <section class="card">
          <div class="row">
            <p class="title">Exclude Glob</p>
            <span class="badge">active</span>
          </div>
          <p class="hint">Skip generated/output folders during workspace scans</p>
        </section>
        <section class="card full">
          <p class="title">Excluded Paths</p>
          <textarea id="excludeLines" spellcheck="false"></textarea>
        </section>
      </div>
      <div class="actions">
        <button class="save" id="saveBtn" type="button">Save Settings</button>
        <button class="reset" id="resetBtn" type="button">Reset Defaults</button>
        <button class="scan" id="scanBtn" type="button">Scan Workspace</button>
        <span id="status" class="status"></span>
      </div>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const defaults = ${JSON.stringify(defaultDryConfig).replace(/</g, "\\u003c")};
    let state = ${boot};

    const ui = {
      toggleNormalized: document.getElementById("toggleNormalized"),
      minLines: document.getElementById("minLines"),
      maxLines: document.getElementById("maxLines"),
      minLinesValue: document.getElementById("minLinesValue"),
      maxLinesValue: document.getElementById("maxLinesValue"),
      excludeLines: document.getElementById("excludeLines"),
      saveBtn: document.getElementById("saveBtn"),
      resetBtn: document.getElementById("resetBtn"),
      scanBtn: document.getElementById("scanBtn"),
      status: document.getElementById("status"),
    };

    function parseExcludeGlob(glob) {
      const value = String(glob || "").trim();
      if (value.startsWith("{") && value.endsWith("}")) {
        return value.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean);
      }
      return value ? [value] : [];
    }

    function toExcludeGlob(lines) {
      const clean = lines.map((x) => x.trim()).filter(Boolean);
      if (clean.length === 0) return defaults.excludeGlob;
      if (clean.length === 1) return clean[0];
      return "{" + clean.join(",") + "}";
    }

    function render() {
      ui.toggleNormalized.classList.toggle("on", !!state.enableNormalizedDetection);
      ui.minLines.value = String(state.minLines);
      ui.maxLines.value = String(state.maxLines);
      ui.minLinesValue.textContent = String(state.minLines);
      ui.maxLinesValue.textContent = String(state.maxLines);
      ui.excludeLines.value = parseExcludeGlob(state.excludeGlob).join("\\n");
    }

    function clampRanges() {
      const min = Math.max(3, Math.min(20, Number(ui.minLines.value || "4")));
      let max = Math.max(4, Math.min(60, Number(ui.maxLines.value || "12")));
      if (max < min) max = min;
      state.minLines = min;
      state.maxLines = max;
      ui.minLines.value = String(min);
      ui.maxLines.value = String(max);
      ui.minLinesValue.textContent = String(min);
      ui.maxLinesValue.textContent = String(max);
    }

    function collect() {
      clampRanges();
      return {
        minLines: state.minLines,
        maxLines: state.maxLines,
        enableNormalizedDetection: !!state.enableNormalizedDetection,
        excludeGlob: toExcludeGlob(ui.excludeLines.value.split(/\\r?\\n/)),
      };
    }

    function flash(text) {
      ui.status.textContent = text;
      setTimeout(() => {
        if (ui.status.textContent === text) ui.status.textContent = "";
      }, 1800);
    }

    ui.toggleNormalized.addEventListener("click", () => {
      state.enableNormalizedDetection = !state.enableNormalizedDetection;
      render();
    });
    ui.minLines.addEventListener("input", clampRanges);
    ui.maxLines.addEventListener("input", clampRanges);

    ui.saveBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "save", payload: collect() });
    });
    ui.resetBtn.addEventListener("click", () => {
      state = { ...defaults };
      render();
      vscode.postMessage({ type: "save", payload: { ...defaults } });
    });
    ui.scanBtn.addEventListener("click", () => {
      vscode.postMessage({ type: "scan", payload: collect() });
    });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (!message || typeof message.type !== "string") return;
      if (message.type === "saved") {
        state = message.payload || state;
        render();
        flash("Saved");
      }
      if (message.type === "scan-done") {
        flash("Scan complete");
      }
      if (message.type === "error") {
        flash(String(message.payload || "Failed"));
      }
    });

    render();
  </script>
</body>
</html>`;
}

export function registerSettingsUiCommand(
  context: vscode.ExtensionContext,
  getSettings: () => DryConfig,
  onSave: (settings: DryConfig) => Promise<void>,
  onScan: (settings: DryConfig) => Promise<void>,
): vscode.Disposable {
  let panel: vscode.WebviewPanel | undefined;

  return vscode.commands.registerCommand("dry.openSettingsUI", async () => {
    if (panel) {
      panel.reveal(vscode.ViewColumn.One);
      panel.webview.html = renderSettingsWebview(panel.webview, getSettings());
      return;
    }

    panel = vscode.window.createWebviewPanel(
      "drySettings",
      "DRY Settings UI",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    panel.webview.html = renderSettingsWebview(panel.webview, getSettings());
    panel.onDidDispose(() => {
      panel = undefined;
    });

    panel.webview.onDidReceiveMessage(async (message) => {
      if (!message || typeof message.type !== "string") {
        return;
      }

      if (message.type === "save") {
        try {
          const settings = normalizeDryConfig((message.payload ?? {}) as Partial<DryConfig>);
          await onSave(settings);
          panel?.webview.postMessage({ type: "saved", payload: settings });
        } catch (error) {
          panel?.webview.postMessage({
            type: "error",
            payload: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (message.type === "scan") {
        try {
          const settings = normalizeDryConfig((message.payload ?? {}) as Partial<DryConfig>);
          await onScan(settings);
          panel?.webview.postMessage({ type: "scan-done" });
        } catch (error) {
          panel?.webview.postMessage({
            type: "error",
            payload: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  });
}
