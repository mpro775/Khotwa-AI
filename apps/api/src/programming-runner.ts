import type {
  ProgrammingResult,
  ProgrammingTest,
  ProgrammingValidation,
} from "../../../packages/contracts/src/product";
import { setTimeout as delay } from "node:timers/promises";

export type Execution = Pick<
  ProgrammingResult,
  "status" | "stdout" | "stderr"
> & {
  /** Internal only: a remotely accepted job may still exist. */
  uncertain?: boolean;
};
export interface RunnerPort {
  execute(
    source: string,
    input: string,
    signal?: AbortSignal,
    onAccepted?: (token: string) => Promise<void>,
  ): Promise<Execution>;
}
export interface RunnerSettings {
  enabled: boolean;
  isolationAttested: boolean;
  baseUrl: string;
  token: string;
  languageId: number;
  timeoutMs: number;
  cpuSeconds: number;
  memoryKiB: number;
  outputBytes: number;
}
const unavailable = (): Execution => ({
  status: "service_error",
  stdout: "",
  stderr: "خدمة التنفيذ المعزول غير متاحة الآن. بقي الكود محفوظًا.",
});
const displayOutput = (value: string): string =>
  Array.from(value)
    .filter((character) => {
      const point = character.codePointAt(0)!;
      return point >= 32 || point === 9 || point === 10 || point === 13;
    })
    .join("");
/** Judge0 is a private, separately managed sandbox. This API process executes no student code. */
export class Judge0Runner implements RunnerPort {
  constructor(
    readonly settings: RunnerSettings,
    private readonly transport: typeof fetch = fetch,
  ) {
    if (!settings.enabled) return;
    const url = new URL(settings.baseUrl);
    if (
      !settings.isolationAttested ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !Number.isInteger(settings.languageId) ||
      settings.languageId <= 0 ||
      settings.token.length < 32 ||
      !Number.isInteger(settings.timeoutMs) ||
      settings.timeoutMs < 1000 ||
      settings.timeoutMs > 30000 ||
      !Number.isFinite(settings.cpuSeconds) ||
      settings.cpuSeconds <= 0 ||
      settings.cpuSeconds > 3 ||
      !Number.isInteger(settings.memoryKiB) ||
      settings.memoryKiB < 16384 ||
      settings.memoryKiB > 131072 ||
      !Number.isInteger(settings.outputBytes) ||
      settings.outputBytes < 1024 ||
      settings.outputBytes > 65536
    )
      throw new Error(
        "Private sandbox isolation and explicit resource limits required",
      );
  }
  private async call(
    path: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const response = await this.transport(
      new URL(path, this.settings.baseUrl),
      {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "content-type": "application/json",
          "X-Auth-Token": this.settings.token,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
        redirect: "error",
      },
    );
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/json")
    )
      throw new Error("runner_unavailable");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("runner_unavailable");
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.length;
        if (size > 196608) throw new Error("runner_output_limit");
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const result: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new Error("runner_invalid_response");
    return result as Record<string, unknown>;
  }
  async execute(
    source: string,
    input: string,
    parentSignal?: AbortSignal,
    onAccepted?: (token: string) => Promise<void>,
  ): Promise<Execution> {
    if (!this.settings.enabled) return unavailable();
    const signal = parentSignal
      ? AbortSignal.any([
          parentSignal,
          AbortSignal.timeout(this.settings.timeoutMs),
        ])
      : AbortSignal.timeout(this.settings.timeoutMs);
    try {
      const submitted = await this.call(
        "/submissions?base64_encoded=true&wait=false",
        {
          source_code: Buffer.from(source).toString("base64"),
          stdin: Buffer.from(input).toString("base64"),
          language_id: this.settings.languageId,
          cpu_time_limit: this.settings.cpuSeconds,
          wall_time_limit: Math.min(6, this.settings.cpuSeconds * 2),
          memory_limit: this.settings.memoryKiB,
          max_file_size: Math.ceil(this.settings.outputBytes / 1024),
          max_processes_and_or_threads: 1,
          enable_network: false,
          number_of_runs: 1,
          redirect_stderr_to_stdout: false,
        },
        signal,
      );
      if (
        typeof submitted.token !== "string" ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(submitted.token)
      )
        return { ...unavailable(), uncertain: true };
      await onAccepted?.(submitted.token);
      for (let i = 0; i < 60; i++) {
        const result = await this.call(
          "/submissions/" +
            submitted.token +
            "?base64_encoded=true&fields=status,stdout,stderr,compile_output",
          undefined,
          signal,
        );
        const status = result.status;
        if (
          !status ||
          typeof status !== "object" ||
          !("id" in status) ||
          typeof status.id !== "number"
        )
          return { ...unavailable(), uncertain: true };
        if (status.id === 1 || status.id === 2) {
          await delay(150, undefined, { signal });
          continue;
        }
        const decode = (value: unknown): string => {
          if (value === null || value === undefined) return "";
          if (
            typeof value !== "string" ||
            value.length > 100000 ||
            !/^[A-Za-z0-9+/=\r\n]*$/.test(value)
          )
            throw new Error("runner_invalid_output");
          const bytes = Buffer.from(value, "base64");
          if (bytes.length > this.settings.outputBytes)
            throw new Error("runner_output_limit");
          if (bytes.toString("base64") !== value.replace(/[\r\n]/g, ""))
            throw new Error("runner_invalid_output");
          // Compare the original UTF-8 output. Display sanitation must never
          // make an incorrect output match the expected answer.
          return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        };
        const stdout = decode(result.stdout),
          stderr = decode(result.stderr),
          compiled = decode(result.compile_output);
        const verdict: Execution["status"] =
          status.id === 3
            ? "succeeded"
            : status.id === 5
              ? "timeout"
              : status.id === 6
                ? "compile_error"
                : status.id === 8
                  ? "resource_limit"
                  : status.id >= 7 && status.id <= 12
                    ? "runtime_error"
                    : "service_error";
        return {
          status: verdict,
          stdout,
          stderr: (compiled || stderr).slice(0, 8192),
        };
      }
      return {
        status: "timeout",
        stdout: "",
        stderr: "تجاوز التنفيذ المهلة المحددة.",
        uncertain: true,
      };
    } catch {
      return signal.aborted
        ? {
            status: "timeout",
            stdout: "",
            stderr:
              "انتهت مهلة خدمة التنفيذ؛ لا يدل ذلك وحده على خطأ في الكود.",
            uncertain: true,
          }
        : { ...unavailable(), uncertain: true };
    }
  }
}
export function runnerFromEnvironment(): Judge0Runner {
  const n = (key: string, fallback: number) =>
    process.env[key] === undefined ? fallback : Number(process.env[key]);
  return new Judge0Runner({
    enabled: process.env.PROGRAMMING_RUNNER_ENABLED === "true",
    isolationAttested: process.env.RUNNER_ISOLATION_ATTESTED === "true",
    baseUrl: process.env.JUDGE0_BASE_URL ?? "http://judge0:2358",
    token: process.env.JUDGE0_AUTH_TOKEN ?? "",
    languageId: n("JUDGE0_PYTHON_LANGUAGE_ID", 0),
    timeoutMs: n("RUNNER_TIMEOUT_MS", 15000),
    cpuSeconds: n("RUNNER_CPU_SECONDS", 2),
    memoryKiB: n("RUNNER_MEMORY_KIB", 131072),
    outputBytes: n("RUNNER_OUTPUT_BYTES", 65536),
  });
}
export const normalizeOutput = (s: string): string =>
  s.replace(/\r\n/g, "\n").replace(/\n$/, "");
export function sourceForTest(
  source: string,
  test: ProgrammingTest,
  functionName?: string,
): { source: string; input: string } {
  if (!functionName) return { source, input: test.input };
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(functionName))
    throw new Error("invalid_function_name");
  const args: unknown = JSON.parse(test.input);
  if (!Array.isArray(args) || args.length > 16)
    throw new Error("invalid_function_arguments");
  return {
    source:
      source +
      "\nimport json as __khotwa_json\nprint(__khotwa_json.dumps(" +
      functionName +
      "(*__khotwa_json.loads(input())), ensure_ascii=False))\n",
    input: JSON.stringify(args),
  };
}
export async function evaluateProgram(
  runner: RunnerPort,
  source: string,
  tests: ProgrammingTest[],
  functionName?: string,
  options: {
    timeoutMs?: number;
    onAccepted?: (token: string) => Promise<void>;
    continueOnFailure?: boolean;
    beforeDispatch?: () => Promise<void>;
  } = {},
): Promise<{
  status: Execution["status"];
  stdout: string;
  stderr: string;
  passed: number;
  total: number;
  allPassed: boolean;
  validation: ProgrammingValidation;
  uncertain: boolean;
}> {
  let passed = 0,
    stdout = "",
    stderr = "";
  let status: Execution["status"] = "succeeded";
  let uncertain = false;
  const cases: ProgrammingValidation["cases"] = tests.map((test, index) => ({
    index,
    visibility: test.hidden ? "hidden" : "public",
    status: "queued",
    passed: false,
    executed: false,
  }));
  const timeoutMs = options.timeoutMs ?? 25000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 25000)
    throw new Error("invalid_evaluation_deadline");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = controller.signal;
  const timedOut = (): Execution => ({
    status: "timeout",
    stdout: "",
    stderr: "انتهت المهلة الإجمالية للاختبارات؛ لم تُحسب النتيجة نجاحًا.",
    uncertain: true,
  });
  try {
    for (const [index, test] of tests.entries()) {
      if (signal.aborted) {
        status = "timeout";
        stderr = "انتهت المهلة الإجمالية للاختبارات؛ لم تُحسب النتيجة نجاحًا.";
        break;
      }
      let execution: Execution;
      let onAbort: (() => void) | undefined;
      try {
        const input = sourceForTest(source, test, functionName);
        const timeout = new Promise<Execution>((resolve) => {
          onAbort = () => resolve(timedOut());
          signal.addEventListener("abort", onAbort, { once: true });
        });
        execution = await Promise.race([
          (async () => {
            await options.beforeDispatch?.();
            if (signal.aborted) return timedOut();
            return runner.execute(
              input.source,
              input.input,
              signal,
              options.onAccepted,
            );
          })(),
          timeout,
        ]);
      } catch {
        execution = signal.aborted
          ? timedOut()
          : { ...unavailable(), uncertain: true };
      } finally {
        if (onAbort) signal.removeEventListener("abort", onAbort);
      }
      uncertain ||= execution.uncertain === true;
      const passedCase =
        execution.status === "succeeded" &&
        normalizeOutput(execution.stdout) ===
          normalizeOutput(test.expectedOutput);
      cases[index] = {
        ...cases[index]!,
        status: execution.status,
        passed: passedCase,
        executed: true,
      };
      if (!test.hidden) {
        stdout = displayOutput(execution.stdout);
        stderr = displayOutput(execution.stderr);
      }
      if (execution.status !== "succeeded") {
        status = execution.status;
        if (test.hidden)
          stderr =
            "لم يكتمل تنفيذ إحدى حالات الاختبار المخفية. راجع الخطأ في الحالات العلنية.";
        if (!options.continueOnFailure || uncertain) break;
      }
      if (passedCase) passed++;
    }
  } finally {
    clearTimeout(timer);
  }
  const allPassed =
    tests.length > 0 && passed === tests.length && status === "succeeded";
  const summary = (visibility: "public" | "hidden") => ({
    passed: cases.filter((c) => c.visibility === visibility && c.passed).length,
    total: cases.filter((c) => c.visibility === visibility).length,
  });
  return {
    status,
    stdout,
    stderr,
    passed,
    total: tests.length,
    allPassed,
    validation: {
      status,
      passed,
      total: tests.length,
      allPassed,
      public: summary("public"),
      hidden: summary("hidden"),
      cases,
    },
    uncertain,
  };
}
