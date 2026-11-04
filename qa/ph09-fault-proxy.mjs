import { createServer } from "node:http";
export async function mathFaultProxy(base, token) {
  const endpoint = new URL(base);
  if (
    endpoint.protocol !== "http:" ||
    !/^khotwa-ph09-[a-f0-9]{12}-math$/.test(endpoint.hostname)
  )
    throw Error("Isolated PH09 math target required");
  let mode = "forward",
    hold = null;
  const arrivals = [];
  const requests = [];
  const server = createServer(async (req, res) => {
    try {
      if (req.headers.authorization !== "Bearer " + token) {
        res.writeHead(403).end();
        return;
      }
      requests.push({ operation: req.url, mode });
      for (const fn of arrivals.splice(0)) fn();
      const gate = hold;
      hold = null;
      if (mode === "timeout") return;
      if (mode === "503") {
        res.writeHead(503, { "content-type": "application/json" }).end("{}");
        return;
      }
      if (mode === "invalid_json") {
        res.writeHead(200, { "content-type": "application/json" }).end("{bad");
        return;
      }
      const chunks = [];
      for await (const b of req) chunks.push(b);
      const r = await fetch(new URL(req.url, endpoint), {
        method: req.method,
        headers: {
          authorization: "Bearer " + token,
          "content-type": "application/json",
        },
        body: req.method === "GET" ? undefined : Buffer.concat(chunks),
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      const body = await r.text();
      if (gate) await gate;
      res.writeHead(r.status, { "content-type": "application/json" }).end(body);
    } catch {
      if (!res.headersSent) res.writeHead(503).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    url: "http://127.0.0.1:" + server.address().port,
    requests,
    nextCall: () => new Promise((r) => arrivals.push(r)),
    holdNext: () => {
      let release;
      hold = new Promise((r) => (release = r));
      return release;
    },
    setMode: (v) => {
      mode = v;
    },
    close: () =>
      new Promise((r) => {
        server.close(r);
        server.closeAllConnections();
      }),
  };
}
