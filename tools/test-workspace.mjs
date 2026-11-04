import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const dir = ".local/ph05-web-tests";
mkdirSync(dir + "/packages/contracts/src/generated", { recursive: true });
writeFileSync(dir + "/package.json", '{"type":"commonjs"}\n');
writeFileSync(
  dir + "/tsconfig.json",
  JSON.stringify(
    {
      extends: "../../tsconfig.base.json",
      compilerOptions: {
        module: "CommonJS",
        moduleResolution: "Node",
        rootDir: "../..",
        outDir: ".",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        noEmit: false,
      },
      include: [
        "../../apps/web/src/api-client.ts",
        "../../apps/web/src/workspace-model.ts",
      ],
    },
    null,
    2,
  ),
);
const compile = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", dir + "/tsconfig.json"],
  { encoding: "utf8" },
);
if (compile.status !== 0) {
  console.error(compile.stdout, compile.stderr);
  process.exit(compile.status ?? 1);
}
copyFileSync(
  "packages/contracts/src/generated/api-validators.cjs",
  dir + "/packages/contracts/src/generated/api-validators.cjs",
);
const result = spawnSync(
  process.execPath,
  ["--test", "apps/web/tests/workspace.test.mjs"],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
