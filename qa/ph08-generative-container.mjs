import { spawnSync } from "node:child_process";
for (const args of [
  ["node_modules/typescript/bin/tsc", "-p", "apps/api/tsconfig.json"],
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--config",
    "apps/api/prisma.config.ts",
  ],
  ["--test", "apps/api/tests/ph08-generative-live.test.mjs"],
]) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
