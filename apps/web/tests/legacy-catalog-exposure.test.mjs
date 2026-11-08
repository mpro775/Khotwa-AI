import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire, Module } from "node:module";
import ts from "typescript";

// Exercise the actual ProductShell hook/event orchestration with controlled
// React scheduling. No browser/network or learner verdict is fabricated here.
function harness() {
  const file = fileURLToPath(
    new URL("../src/ProductShell.tsx", import.meta.url),
  );
  const state = [],
    refs = [],
    dependencies = [],
    effects = [],
    calls = [],
    deferred = [];
  let stateIndex = 0,
    refIndex = 0,
    effectIndex = 0,
    dirty = false,
    tree,
    delay = false;
  const react = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [
        state[index],
        (value) => {
          const next =
            typeof value === "function" ? value(state[index]) : value;
          if (!Object.is(next, state[index])) {
            state[index] = next;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useEffect(setup, deps) {
      const index = effectIndex++,
        old = dependencies[index];
      if (
        !old ||
        old.length !== deps.length ||
        deps.some((value, i) => !Object.is(value, old[i]))
      ) {
        dependencies[index] = deps;
        effects.push(setup);
      }
    },
  };
  const user = (id) => ({
    user: {
      id,
      email: `${id}@example.invalid`,
      role: "student",
      status: "active",
    },
    csrfToken: "test-only",
    guestAvailable: false,
  });
  class ProductApi {
    async me() {
      return user("student-a");
    }
    request(path) {
      calls.push(path);
      if (delay) return new Promise((resolve) => deferred.push(resolve));
      return Promise.resolve({ subjects: [] });
    }
  }
  const nativeRequire = createRequire(file),
    mod = new Module(file);
  mod.require = (name) => {
    if (name === "react") return react;
    if (name === "./product-api")
      return {
        ProductApi,
        catalogData: (value) => value,
        messageOf: () => "error",
        record: (value) => value,
        textField: (value) => value,
      };
    if (name === "./product-session") return { clearLearningStorage: () => {} };
    if (name.endsWith(".css")) return {};
    if (name.startsWith("./"))
      return new Proxy(
        {},
        {
          get: (_target, key) =>
            key === "__esModule"
              ? true
              : function Stub() {
                  return null;
                },
        },
      );
    return nativeRequire(name);
  };
  mod._compile(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    effectIndex = 0;
    dirty = false;
    tree = mod.exports.ProductShell();
  };
  const flush = async () => {
    if (dirty) render();
    for (let i = 0; i < 8; i++) {
      const pending = effects.splice(0);
      for (const effect of pending) effect();
      await new Promise((resolve) => setImmediate(resolve));
      if (dirty) render();
      else if (!effects.length) return;
    }
    throw Error("Component effect loop did not settle");
  };
  const find = (predicate, node = tree) => {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = find(predicate, child ?? null);
        if (found) return found;
      }
      return null;
    }
    if (predicate(node)) return node;
    return find(predicate, node.props?.children ?? null);
  };
  const text = (node) =>
    typeof node === "string"
      ? node
      : Array.isArray(node)
        ? node.map(text).join("")
        : node && typeof node === "object"
          ? text(node.props?.children)
          : "";
  render();
  return {
    calls,
    deferred,
    flush,
    find,
    text,
    user,
    setDelay: () => {
      delay = true;
    },
  };
}

test("opening learning paths does not disclose the legacy catalog; explicit bank open loads it once", async () => {
  const h = harness();
  await h.flush();
  assert.deepEqual(
    h.calls,
    [],
    "authentication alone must not fetch every physics question",
  );
  let bank = h.find(
    (node) =>
      node.type === "details" && node.props.className === "legacy-problem-bank",
  );
  assert.equal(bank.props.open, false);
  bank.props.onToggle({ currentTarget: { open: true } });
  await h.flush();
  assert.deepEqual(h.calls, ["/catalog"]);
  bank = h.find(
    (node) =>
      node.type === "details" && node.props.className === "legacy-problem-bank",
  );
  bank.props.onToggle({ currentTarget: { open: false } });
  await h.flush();
  bank = h.find(
    (node) =>
      node.type === "details" && node.props.className === "legacy-problem-bank",
  );
  bank.props.onToggle({ currentTarget: { open: true } });
  await h.flush();
  assert.deepEqual(
    h.calls,
    ["/catalog"],
    "reopening the already displayed bank does not refetch",
  );
  h.find(
    (node) =>
      node.type === "button" &&
      h.text(node).includes("حدّث بنك المسائل المنشورة"),
  ).props.onClick();
  await h.flush();
  assert.deepEqual(
    h.calls,
    ["/catalog", "/catalog"],
    "manual refresh remains available",
  );
});

test("an identity switch closes the legacy bank and rejects its late result", async () => {
  const h = harness();
  await h.flush();
  h.setDelay();
  h.find(
    (node) =>
      node.type === "button" &&
      h.text(node).includes("حدّث بنك المسائل المنشورة"),
  ).props.onClick();
  await h.flush();
  assert.equal(h.deferred.length, 1);
  h.find(
    (node) => typeof node.props?.onIdentity === "function",
  ).props.onIdentity(h.user("student-b"));
  await h.flush();
  h.deferred[0]({
    subjects: [
      { code: "physics", titleAr: "STALE_EXPOSED_CONTENT", units: [] },
    ],
  });
  await h.flush();
  const bank = h.find(
    (node) =>
      node.type === "details" && node.props.className === "legacy-problem-bank",
  );
  assert.equal(bank.props.open, false);
  assert.equal(h.text(bank).includes("STALE_EXPOSED_CONTENT"), false);
  assert.deepEqual(h.calls, ["/catalog"]);
});
