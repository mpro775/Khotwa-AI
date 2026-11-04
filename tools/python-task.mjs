import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
const local = path.resolve(
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const executable = existsSync(local)
  ? local
  : (process.env.PYTHON ??
    (process.platform === "win32" ? "python" : "python3"));
const result = spawnSync(executable, process.argv.slice(2), {
  stdio: "inherit",
  shell: false,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
