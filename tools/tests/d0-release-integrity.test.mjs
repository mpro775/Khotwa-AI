import assert from "node:assert/strict";
import test from "node:test";
import {
  snapshot,
  validateInventoryPath,
  verifySnapshot,
} from "../d0-release-integrity.mjs";

test("D0 inventories reject private paths and path traversal before reading", () => {
  for (const name of [
    "../.env",
    "/etc/passwd",
    "C:/private/key",
    ".env",
    ".env.local",
    ".local/key",
    "node_modules/pkg/file.js",
    "apps/api/dist/main.js",
    "archive.zip",
    "apps\\api\\file.ts",
  ]) {
    let read = false;
    assert.throws(() =>
      snapshot([name], () => {
        read = true;
        return Buffer.from("private");
      }),
    );
    assert.equal(read, false);
  }
  assert.equal(validateInventoryPath(".env.example"), ".env.example");
});

test("D0 verification detects byte changes, deletion and inventory additions", () => {
  const files = { "a.ts": Buffer.from("one\n"), "b.ts": Buffer.from("two\n") };
  const read = (name) => files[name];
  const saved = snapshot(["b.ts", "a.ts", "a.ts"], read);
  verifySnapshot(saved, snapshot(["a.ts", "b.ts"], read));
  assert.throws(() => verifySnapshot(saved, snapshot(["a.ts"], read)));
  files["c.ts"] = Buffer.from("three\n");
  assert.throws(() =>
    verifySnapshot(saved, snapshot(Object.keys(files), read)),
  );
  files["a.ts"] = Buffer.from("one\r\n");
  assert.throws(() => verifySnapshot(saved, snapshot(["a.ts", "b.ts"], read)));
});
