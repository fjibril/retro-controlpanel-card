#!/usr/bin/env node
// Write a native GitHub Actions job summary (markdown table) from the JUnit
// XML the test runs produce. Appended to $GITHUB_STEP_SUMMARY, which GitHub
// renders on the workflow run page - no third-party action needed.

import { readFileSync, appendFileSync } from "node:fs";

const read = (f) => {
  try {
    return readFileSync(f, "utf8");
  } catch {
    return "";
  }
};

// Pull the first `name="<digits>"` attribute (the top-level <testsuites> totals).
const attr = (xml, name) => {
  const m = xml.match(new RegExp(`${name}="(\\d+)"`));
  return m ? Number(m[1]) : null;
};

function row(label, file) {
  const xml = read(file);
  if (!xml) return `| ${label} | — | — | not run |`;
  const tests = attr(xml, "tests");
  const failures = attr(xml, "failures");
  const status = failures === 0 ? "✅ pass" : "❌ fail";
  return `| ${label} | ${tests ?? "?"} | ${failures ?? "?"} | ${status} |`;
}

const isTag = (process.env.GITHUB_REF_NAME ?? "").startsWith("v");
const md = [
  "## Test results",
  "",
  "| Suite | Tests | Failures | Status |",
  "| --- | ---: | ---: | :--- |",
  row("Unit (vitest)", "reports/junit-unit.xml"),
  row("UI (Playwright)", "reports/junit-ui.xml"),
  "",
  "Full HTML reports are in the **test-reports** artifact on this run" +
    (isTag ? ", and in `test-reports.zip` attached to the release." : "."),
  "",
].join("\n");

const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) appendFileSync(summaryFile, md + "\n");
process.stdout.write(md + "\n");
