import { createServer } from "node:https";
import { request as httpRequest } from "node:http";
import {
  readFileSync,
  existsSync,
  statSync,
  realpathSync,
  appendFileSync,
} from "node:fs";
import path from "node:path";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};
const banner =
  '<aside dir="rtl" style="background:#fff4c2;color:#1f2937;padding:12px;border-bottom:2px solid #b7791f;font:16px sans-serif">بيئة اختبار اصطناعية محفوظة — الموافقات هنا لا تمثل اعتمادًا تربويًا — Beta/AI/Runner متوقفة<br><a href="/__v22/teacher">المعلم الاختباري</a> · <a href="/__v22/student-a">الطالب أ</a> · <a href="/__v22/student-b">الطالب ب</a> · <a href="/__v22/student-c">الطالب ج</a></aside>';

/** Local acceptance harness only: built React assets and a private Nest proxy. */
export function createManualHttpServer({
  root,
  local,
  cert,
  key,
  base,
  actors,
}) {
  const dist = path.resolve(root, "apps/web/dist"),
    index = path.join(dist, "index.html");
  if (!existsSync(index))
    throw Error("Build apps/web before starting manual acceptance");
  const server = createServer(
    { cert: readFileSync(cert), key: readFileSync(key) },
    (request, response) => {
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Cache-Control", "private, no-store");
      let url;
      const target = request.url ?? "/";
      if (!target.startsWith("/") || target.startsWith("//")) {
        response.writeHead(400);
        response.end("Origin-form local requests only");
        return;
      }
      try {
        url = new URL(target, "https://localhost:8462");
      } catch {
        response.writeHead(400);
        response.end("Invalid local request");
        return;
      }
      if (
        request.headers.host !== "localhost:8462" ||
        url.origin !== "https://localhost:8462"
      ) {
        response.writeHead(403);
        response.end("Local test hostname only");
        return;
      }
      const name = url.pathname.startsWith("/__v22/")
        ? url.pathname.slice(7)
        : null;
      if (
        name &&
        ["teacher", "student-a", "student-b", "student-c"].includes(name) &&
        Object.hasOwn(actors, name)
      ) {
        if (
          request.method !== "GET" ||
          ![undefined, "none", "same-origin"].includes(
            request.headers["sec-fetch-site"],
          )
        ) {
          response.writeHead(403);
          response.end("Local test shortcut only");
          return;
        }
        response.setHeader("Set-Cookie", [
          `kh_account=${actors[name].token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
          "kh_guest=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
        ]);
        response.writeHead(302, { location: "/" });
        response.end();
        return;
      }
      if (name !== null) {
        response.writeHead(404);
        response.end("Unknown local test identity");
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        if (
          !url.pathname.startsWith("/api/v1/") ||
          url.pathname.startsWith("/api/v1/internal/")
        ) {
          response.writeHead(404);
          response.end();
          return;
        }
        let requestId = null;
        response.once("finish", () =>
          appendFileSync(
            path.join(local, "requests.ndjson"),
            JSON.stringify({
              at: new Date().toISOString(),
              method: request.method,
              path: url.pathname,
              status: response.statusCode,
              requestId,
            }) + "\n",
          ),
        );
        const upstream = httpRequest(
          new URL(url.pathname + url.search, base),
          {
            method: request.method,
            headers: { ...request.headers, host: new URL(base).host },
          },
          (incoming) => {
            requestId = incoming.headers["x-request-id"] ?? null;
            response.writeHead(incoming.statusCode ?? 502, incoming.headers);
            incoming.pipe(response);
          },
        );
        upstream.once("error", () => {
          if (!response.headersSent)
            response.writeHead(503, { "content-type": "application/json" });
          response.end(
            JSON.stringify({
              error: {
                code: "local_proxy_unavailable",
                messageAr: "تعذر الاتصال بخادم الاختبار المحلي.",
              },
            }),
          );
        });
        request.once("aborted", () => upstream.destroy());
        request.pipe(upstream);
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405);
        response.end();
        return;
      }
      let relative;
      try {
        relative = decodeURIComponent(url.pathname);
      } catch {
        response.writeHead(400);
        response.end();
        return;
      }
      const candidate = path.resolve(dist, "." + relative);
      if (candidate !== dist && !candidate.startsWith(dist + path.sep)) {
        response.writeHead(404);
        response.end();
        return;
      }
      const file =
        existsSync(candidate) && statSync(candidate).isFile()
          ? candidate
          : index;
      const actual = realpathSync(file);
      if (actual !== dist && !actual.startsWith(dist + path.sep)) {
        response.writeHead(404);
        response.end();
        return;
      }
      const type = mime[path.extname(file)] ?? "application/octet-stream";
      response.setHeader("Content-Type", type);
      const data =
        file === index
          ? readFileSync(index, "utf8").replace(/<body>/, "<body>" + banner)
          : readFileSync(file);
      response.writeHead(200);
      response.end(request.method === "HEAD" ? undefined : data);
    },
  );
  return {
    listen: () =>
      new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(8462, "127.0.0.1", resolve);
      }),
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
