import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const relative = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^[/\\]+/, "");
  let file = join(root, relative || "index.html");

  if (!file.startsWith(root) || !existsSync(file)) {
    response.writeHead(404).end("Not found");
    return;
  }

  if (statSync(file).isDirectory()) file = join(file, "index.html");
  response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Incident Replay Workbench: http://127.0.0.1:${port}`);
});
