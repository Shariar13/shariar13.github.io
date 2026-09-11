#!/usr/bin/env node
// Tiny static server for ./dist that mimics Cloudflare Pages routing (clean URLs, 404.html).
const http = require("http"), fs = require("fs"), path = require("path");
const DIST = path.join(__dirname, "..", "dist");
const PORT = process.env.PORT || 8080;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".xml": "application/xml; charset=utf-8", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(DIST, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  else if (!path.extname(file) && fs.existsSync(file + ".html")) file = file + ".html";
  let status = 200;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { file = path.join(DIST, "404.html"); status = 404; }
  res.writeHead(status, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`▶ Serving dist/ at http://localhost:${PORT}`));
