import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const buildCommand = process.platform === "win32" ? "cmd.exe" : "npm";
const buildArguments = process.platform === "win32"
  ? ["/d", "/s", "/c", "npm run build"]
  : ["run", "build"];
const build = spawnSync(buildCommand, buildArguments, {
  env: process.env,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

const outputRoot = resolve("out");
const outputPrefix = `${outputRoot}${sep}`;
const basePath = (process.env.STATIC_BASE_PATH ?? "").replace(/\/+$/, "");
const port = Number(process.env.STATIC_SERVER_PORT ?? "3200");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".woff2", "font/woff2"],
]);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (basePath && url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) {
    response.writeHead(404).end();
    return;
  }

  let pathname = decodeURIComponent(url.pathname.slice(basePath.length) || "/");
  if (pathname.endsWith("/")) pathname += "index.html";
  const filePath = resolve(outputRoot, `.${pathname}`);
  if (filePath !== outputRoot && !filePath.startsWith(outputPrefix)) {
    response.writeHead(403).end();
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    try {
      const notFound = await readFile(resolve(outputRoot, "404.html"));
      response.writeHead(404, {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
      });
      response.end(request.method === "HEAD" ? undefined : notFound);
    } catch {
      response.writeHead(404).end();
    }
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Static GitHub Pages export ready on http://127.0.0.1:${port}${basePath}/`);
});
