#!/usr/bin/env node
// Convert vitest's JSON report into a single self-contained HTML file that
// opens directly in a browser (no server needed) - handy when the reports are
// extracted out of the build container. Zero dependencies on purpose.
//
//   node tools/json-to-html.mjs <input.json> <output.html>

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const inPath = process.argv[2] ?? "reports/unit.json";
const outPath = process.argv[3] ?? "reports/unit-report.html";

let data;
try {
  data = JSON.parse(readFileSync(inPath, "utf8"));
} catch (err) {
  // Don't fail the build just because a report couldn't be produced.
  console.error(`json-to-html: could not read ${inPath}: ${err.message}`);
  process.exit(0);
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const files = Array.isArray(data.testResults) ? data.testResults : [];
const total = data.numTotalTests ?? 0;
const passed = data.numPassedTests ?? 0;
const failed = data.numFailedTests ?? 0;
const skipped = (data.numPendingTests ?? 0) + (data.numTodoTests ?? 0);
const ok = failed === 0;
const when = data.startTime ? new Date(data.startTime).toLocaleString() : "";

const shortName = (p) => {
  const i = String(p).lastIndexOf("tests/");
  return i >= 0 ? String(p).slice(i) : String(p);
};

const sections = files
  .map((f) => {
    const cases = Array.isArray(f.assertionResults) ? f.assertionResults : [];
    const fFailed = cases.filter((c) => c.status === "failed").length;
    const rows = cases
      .map((c) => {
        const cls =
          c.status === "passed" ? "pass" : c.status === "failed" ? "fail" : "skip";
        const icon = cls === "pass" ? "✔" : cls === "fail" ? "✘" : "○";
        const title = [...(c.ancestorTitles ?? []), c.title].filter(Boolean).join(" › ");
        const dur = c.duration != null ? `${Math.round(c.duration)} ms` : "";
        const msg = (c.failureMessages ?? []).join("\n\n");
        return `<tr class="${cls}"><td class="ic">${icon}</td><td class="ti">${esc(title)}${
          msg ? `<pre class="msg">${esc(msg)}</pre>` : ""
        }</td><td class="du">${dur}</td></tr>`;
      })
      .join("");
    return `<section class="file${fFailed ? " has-fail" : ""}"><h2>${esc(
      shortName(f.name),
    )} <span class="badge ${fFailed ? "fail" : "pass"}">${cases.length - fFailed}/${
      cases.length
    }</span></h2><table>${rows}</table></section>`;
  })
  .join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unit test report</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 "Segoe UI", system-ui, sans-serif; margin: 0; background: #14110d; color: #e8e3d8; }
  header { padding: 20px 24px; background: linear-gradient(180deg,#2a2520,#14110d); border-bottom: 2px solid ${ok ? "#6dff7a" : "#ff4a3a"}; }
  h1 { margin: 0 0 6px; font: 700 18px "Futura","Arial Narrow",sans-serif; letter-spacing: .12em; text-transform: uppercase; }
  .summary { color: #b9b2a3; }
  .big { font-size: 22px; font-weight: 700; color: ${ok ? "#6dff7a" : "#ffa033"}; }
  .failnum { color: #ff5a4a; font-weight: 700; }
  section.file { margin: 18px 24px; border: 1px solid #2e2922; border-radius: 8px; overflow: hidden; }
  section.file h2 { margin: 0; padding: 10px 14px; font: 600 13px "Consolas",monospace; background: #1d1913; display: flex; justify-content: space-between; align-items: center; }
  .badge { font: 700 11px sans-serif; padding: 2px 8px; border-radius: 10px; }
  .badge.pass { background: rgba(109,255,122,.15); color: #6dff7a; }
  .badge.fail { background: rgba(255,74,58,.18); color: #ff7a6a; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 10px; border-top: 1px solid #241f19; vertical-align: top; }
  td.ic { width: 1.4em; text-align: center; font-weight: 700; }
  td.du { width: 6em; text-align: right; color: #8c857a; white-space: nowrap; }
  tr.pass td.ic { color: #6dff7a; }
  tr.fail td.ic { color: #ff5a4a; }
  tr.skip td.ic { color: #8c857a; }
  tr.fail td.ti { color: #ffd9d2; }
  pre.msg { margin: 8px 0 2px; padding: 10px; background: #1a0d0b; border-left: 3px solid #ff4a3a; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; color: #ffc9c0; font: 12px/1.45 "Consolas",monospace; }
</style></head><body>
<header>
  <h1>Unit Test Report</h1>
  <div class="summary"><span class="big">${passed}/${total}</span> passed${
    failed ? ` · <span class="failnum">${failed} failed</span>` : ""
  }${skipped ? ` · ${skipped} skipped` : ""}${when ? ` · ${esc(when)}` : ""}</div>
</header>
${sections || "<p style='margin:24px'>No test results found.</p>"}
</body></html>`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(`json-to-html: wrote ${outPath}`);
