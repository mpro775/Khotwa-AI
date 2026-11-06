// Test infrastructure only. Every verdict is forwarded unchanged from real Python.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
const base = new URL(process.env.REAL_MATH_BASE_URL),
  token = process.env.MATH_INTERNAL_TOKEN;
if (
  !token ||
  token.length < 32 ||
  base.protocol !== "http:" ||
  !/^khotwa-ph05-[a-f0-9]{12}-math$/.test(base.hostname)
)
  throw new Error("Isolated math target required");
let forwarded = 0,
  delayed = 0;
createServer(async (req, res) => {
  try {
    if (req.headers.authorization !== "Bearer " + token) {
      res.writeHead(403).end();
      return;
    }
    if (
      ![
        "/internal/health",
        "/internal/v1/math/parse",
        "/internal/v1/math/verify-transition",
        "/internal/v1/math/check-final",
      ].includes(req.url)
    ) {
      res.writeHead(404).end();
      return;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8192) {
        res.writeHead(400).end();
        return;
      }
      chunks.push(chunk);
    }
    const result = await fetch(new URL(req.url, base), {
      method: req.method,
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: req.method === "GET" ? undefined : Buffer.concat(chunks),
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    const body = await result.text();
    forwarded++;
    if (
      req.url.endsWith("/verify-transition") &&
      existsSync("/tmp/ph05-delay-next")
    ) {
      const milliseconds = Math.min(
        10000,
        Math.max(0, Number(readFileSync("/tmp/ph05-delay-next", "utf8")) || 0),
      );
      unlinkSync("/tmp/ph05-delay-next");
      delayed++;
      await new Promise((resolve) => setTimeout(resolve, milliseconds));
    }
    writeFileSync(
      "/tmp/ph05-proxy-counts.json",
      JSON.stringify({
        forwarded,
        delayed,
        mathVerdicts: "unchanged real Python responses",
      }),
    );
    res.writeHead(result.status, {
      "content-type": result.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(503, { "content-type": "application/json" });
    res.end("{}");
  }
}).listen(8002, "0.0.0.0");
