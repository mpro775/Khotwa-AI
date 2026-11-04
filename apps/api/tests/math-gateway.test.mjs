import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const { MathGateway } = require("../dist/math-gateway.js");
const examples = JSON.parse(
  readFileSync(
    new URL(
      "../../../docs/contracts/math-internal-v1.examples.json",
      import.meta.url,
    ),
    "utf8",
  ),
).examples;
const fixture = (name) =>
  structuredClone(examples.find((e) => e.schema === name).payload);
test("private math adapter validates schemas, bounded responses, versions and request context", async (t) => {
  let mode = "parse",
    calls = 0,
    lastRequest;
  const server = createServer(async (req, res) => {
    calls++;
    assert.equal(req.headers.authorization, "Bearer " + "t".repeat(43));
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const request = JSON.parse(raw);
    lastRequest = request;
    let result;
    if (req.url.endsWith("parse")) {
      result = fixture("InternalMathParseResult");
      Object.assign(result, {
        requestId: request.requestId,
        context: request.context,
        source: request.source,
        engineVersion: "0.3.0",
      });
    } else if (req.url.endsWith("verify-transition")) {
      result = fixture("InternalMathTransitionResult");
      Object.assign(result, {
        requestId: request.requestId,
        attemptRevision: request.context.attemptRevision,
        engineVersion: "0.3.0",
      });
    } else {
      result = fixture("InternalMathCheckFinalResult");
      Object.assign(result, {
        requestId: request.requestId,
        context: request.context,
        finalStepVersionId: request.finalStep.stepVersionId,
        engineVersion: "0.3.0",
      });
    }
    if (mode === "http500") {
      res.writeHead(500);
      res.end("secret internal trace");
      return;
    }
    res.setHeader(
      "content-type",
      mode === "html" ? "text/html" : "application/json",
    );
    if (mode === "invalid_json") {
      res.end("secret not JSON");
      return;
    }
    if (mode === "oversized") {
      res.end(JSON.stringify({ secret: "x".repeat(70000) }));
      return;
    }
    if (mode === "timeout") {
      setTimeout(() => res.end(JSON.stringify(result)), 200);
      return;
    }
    if (mode === "wrong_version") result.engineVersion = "999";
    if (mode === "wrong_notation") result.notationProfileVersion = "other";
    if (mode === "wrong_request") result.requestId = randomUUID();
    if (mode === "wrong_context") result.context.attemptId = randomUUID();
    if (mode === "wrong_source") result.source.stepVersionId = randomUUID();
    if (mode === "wrong_raw") result.ast.sourceRaw = "س = ٣";
    if (mode === "wrong_revision") result.attemptRevision = 99;
    if (mode === "extra") result.secret = "secret";
    if (mode === "invalid_without_proof") {
      result.status = "verified_invalid";
      result.evidence = null;
    }
    if (mode === "unsupported") {
      Object.assign(result, {
        parseStatus: "unsupported",
        ast: null,
        normalizedText: null,
        displayAr: null,
        reasonCode: "UNSUPPORTED_FUNCTION",
        issue: {
          reasonCode: "UNSUPPORTED_FUNCTION",
          messageAr: "هذه الدالة خارج النطاق.",
          spanStart: 0,
          spanEnd: 2,
          spanUnit: "unicode_codepoint",
          hintKey: null,
        },
      });
    }
    if (mode === "service_error")
      Object.assign(result, {
        status: "service_error",
        evidence: null,
        reasonCode: "WORKER_TIMEOUT",
        issue: null,
      });
    res.end(JSON.stringify(result));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const gateway = new MathGateway({
    baseUrl: "http://127.0.0.1:" + server.address().port,
    token: "t".repeat(43),
    timeoutMs: 1000,
    expectedEngine: "0.3.0",
  });
  const context = {
    attemptId: randomUUID(),
    attemptRevision: 4,
    problemRevisionId: randomUUID(),
    notationProfile: "ar-mashriq-school-v1",
    domain: "reals",
  };
  const source = { kind: "step", stepVersionId: randomUUID() };
  const transition = {
    fromKind: "problem",
    fromStepVersionId: null,
    toStepVersionId: source.stepVersionId,
    fromRaw: "٢س=٤",
    toRaw: "س=٢",
  };
  const unavailable = (e) =>
    e.status === 503 &&
    e.code === "math_unavailable" &&
    !e.messageAr.includes("secret");
  try {
    await t.test(
      "parse preserves raw and context without judging correctness",
      async () => {
        const result = await gateway.parse(context, source, "س = ٢");
        assert.equal(result.parseStatus, "parsed");
        assert.equal(result.ast.sourceRaw, "س = ٢");
        assert.deepEqual(lastRequest.context, context);
      },
    );
    await t.test(
      "unsupported input remains a nonconceptual status",
      async () => {
        mode = "unsupported";
        const result = await gateway.parse(context, source, "جا(س)=٢");
        assert.equal(result.parseStatus, "unsupported");
        assert.equal(result.ast, null);
      },
    );
    for (const failure of [
      "http500",
      "html",
      "invalid_json",
      "oversized",
      "wrong_version",
      "wrong_notation",
      "wrong_request",
      "wrong_context",
      "wrong_source",
      "wrong_raw",
      "extra",
    ]) {
      await t.test("rejects " + failure, async () => {
        mode = failure;
        await assert.rejects(
          gateway.parse(context, source, "س = ٢"),
          unavailable,
        );
      });
    }
    await t.test(
      "actual aborted HTTP deadline returns operational unavailability",
      async () => {
        mode = "timeout";
        const fast = new MathGateway({ ...gateway.settings, timeoutMs: 30 });
        await assert.rejects(fast.parse(context, source, "س = ٢"), unavailable);
      },
    );
    await t.test(
      "transition accepts verified proof and preserves service failure",
      async () => {
        mode = "verify";
        const result = await gateway.verify(context, transition);
        assert.ok(
          ["verified_valid", "verified_invalid"].includes(result.status),
        );
        mode = "service_error";
        assert.equal(
          (await gateway.verify(context, transition)).status,
          "service_error",
        );
      },
    );
    for (const failure of ["wrong_revision", "invalid_without_proof"]) {
      await t.test("transition rejects " + failure, async () => {
        mode = failure;
        await assert.rejects(gateway.verify(context, transition), unavailable);
      });
    }
    await t.test(
      "source-kind mismatch is rejected before a network call",
      async () => {
        const before = calls;
        await assert.rejects(
          gateway.verify(context, {
            ...transition,
            fromStepVersionId: randomUUID(),
          }),
          unavailable,
        );
        assert.equal(calls, before);
      },
    );
    await t.test("check-final validates pinned final version", async () => {
      mode = "final";
      const r = await gateway.checkFinal(context, "٢س=٤", {
        stepVersionId: source.stepVersionId,
        raw: "س = ٢",
      });
      assert.equal(r.finalStepVersionId, source.stepVersionId);
      mode = "wrong_context";
      await assert.rejects(
        gateway.checkFinal(context, "٢س=٤", {
          stepVersionId: source.stepVersionId,
          raw: "س = ٢",
        }),
        unavailable,
      );
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
