import { spawnSync } from "node:child_process";
import path from "node:path";

const result = spawnSync(
  process.execPath,
  [
    "tools/python-task.mjs",
    "-X",
    "utf8",
    "-m",
    "unittest",
    "discover",
    "-s",
    "services/math-engine/tests",
    "-v",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PYTHONPATH: path.resolve("services/math-engine/src"),
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
