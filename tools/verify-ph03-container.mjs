import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const base = ["compose", "--env-file", ".local/compose.env"];
const commands = [];
function run(executable, args) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  commands.push({
    executable: executable === process.execPath ? "node" : executable,
    args,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  writeFileSync(
    "qa-reports/ph03-container-commands.json",
    JSON.stringify(
      {
        phase: "PH-03",
        recordedAtRiyadh: new Date().toLocaleString("sv-SE", {
          timeZone: "Asia/Riyadh",
        }),
        commands,
        scope:
          "Local math image and existing private Compose regression only; no public deployment or migration",
      },
      null,
      2,
    ) + "\n",
  );
  if (result.status !== 0)
    throw new Error("Container check failed; see ph03-container-commands.json");
  return result.stdout.trim();
}
run("docker", [...base, "config", "--quiet"]);
run("docker", [...base, "build", "math-engine"]);
run("docker", [...base, "up", "-d", "--no-deps", "--wait", "math-engine"]);
run(process.execPath, ["tools/compose-smoke.mjs"]);
const imageId = run("docker", [
  "image",
  "inspect",
  "khotwa-ph01-math-engine",
  "--format",
  "{{.Id}}",
]);
const args = [
  "run",
  "--rm",
  "--network",
  "none",
  "--memory",
  "256m",
  "--cpus",
  "1",
  "--pids-limit",
  "64",
  "--read-only",
  "--tmpfs",
  "/tmp",
  "--mount",
  "type=bind,source=" + path.resolve("qa") + ",target=/qa,readonly",
  "khotwa-ph01-math-engine",
  "python",
  "-X",
  "utf8",
  "/qa/ph03_container_smoke.py",
];
const report = JSON.parse(run("docker", args));
report.command = ["docker", ...args];
report.exitCode = 0;
report.imageId = imageId;
report.recordedAtRiyadh = new Date().toLocaleString("sv-SE", {
  timeZone: "Asia/Riyadh",
});
writeFileSync(
  "qa-reports/ph03-container-checks.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  "PH-03 containers: 14 existing Compose checks and " +
    report.passed +
    " isolated Linux resource/worker checks passed.",
);
