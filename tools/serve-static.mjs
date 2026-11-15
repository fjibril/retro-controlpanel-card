#!/usr/bin/env node
// Minimal static file server for the Playwright UI tests (`npm run serve:ui`).
// Serves the repo root so the fixture page (tests/ui/fixtures/index.html) can
// load /dist/retro-controlpanel-card.js. Zero dependencies on purpose: it
// replaces http-server, which is unmaintained and pulled in deprecated
// packages. Like the old `http-server -c-1 --cors`, responses are never cached
// and carry a permissive CORS header.
//
// Usage: node tools/serve-static.mjs [port]   (default 8765, binds 127.0.0.1)

import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";

const root = resolve(".");
const port = Number(process.argv[2] ?? 8765);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const send = (status, body, type = "text/plain; charset=utf-8") => {
    res.writeHead(status, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  };

  if (req.method !== "GET" && req.method !== "HEAD") return send(405, "Method Not Allowed");

  let file;
  try {
    file = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  } catch {
    return send(400, "Bad Request");
  }
  // Refuse anything that resolves outside the served root (e.g. /%2e%2e%2f).
  if (file !== root && !file.startsWith(root + sep)) return send(403, "Forbidden");

  try {
    if ((await stat(file)).isDirectory()) {
      const index = join(file, "index.html");
      const hasIndex = await stat(index).then(() => true, () => false);
      // Playwright's webServer readiness probe requests "/", which has no
      // index.html - answer it (and any other bare directory) with a listing.
      if (!hasIndex) return send(200, (await readdir(file)).join("\n"));
      file = index;
    }
    send(200, await readFile(file), TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
  } catch {
    send(404, "Not Found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`serving ${root} at http://127.0.0.1:${port}`);
});
