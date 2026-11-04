"""Small Linux worker/resource probe in an isolated, disposable container."""

import json
import os
import sys
from pathlib import Path

from khotwa_math import ENGINE_VERSION, NOTATION_VERSION, WIRE_VERSION
from khotwa_math.protocol import validate_request
from khotwa_math.worker_manager import WorkerManager


def main() -> None:
    checks: list[dict[str, object]] = []

    def record(name: str, passed: bool, detail: object = None) -> None:
        checks.append({"name": name, "passed": passed, "detail": detail})
        assert passed, name

    record("non_root", os.getuid() == 10001)
    record(
        "no_external_network_interface",
        sorted(p.name for p in Path("/sys/class/net").iterdir()) == ["lo"],
    )
    root_mount = next(
        line.split()[3]
        for line in Path("/proc/mounts").read_text().splitlines()
        if line.split()[1] == "/"
    )
    record("read_only_root", "ro" in root_mount.split(","))
    memory = int(Path("/sys/fs/cgroup/memory.max").read_text())
    record("container_memory_cap_256_mib", memory == 256 * 1024 * 1024, memory)
    quota, period = Path("/sys/fs/cgroup/cpu.max").read_text().split()
    record(
        "cpu_cap_one_core",
        int(quota) <= int(period),
        {"quota": quota, "period": period},
    )
    context = {
        "attemptId": "00000000-0000-4000-8000-000000000001",
        "attemptRevision": 4,
        "problemRevisionId": "00000000-0000-4000-8000-000000000002",
        "notationProfile": NOTATION_VERSION,
        "domain": "reals",
    }
    manager = WorkerManager()
    manager.start()
    try:
        record(
            "worker_rlimit_as_192_mib",
            manager.runtime_details["memoryLimitBytes"] == 192 * 1024 * 1024,
            manager.runtime_details,
        )
        for old, new, expected in (
            ("٢(س+٣)=١٠", "س+٣=٥", "verified_valid"),
            ("٢(س+٣)=١٠", "٢س+٣=١٠", "verified_invalid"),
            ("س=٢", "س/س=١", "unsupported"),
            ("س=٢", "س/٠=١", "syntax_error"),
            ("س=٢", "س=١" + ("/" + "٩" * 18) * 5, "inconclusive"),
        ):
            data = {
                "schemaVersion": WIRE_VERSION,
                "requestId": "00000000-0000-4000-8000-000000000003",
                "context": context,
                "transition": {
                    "fromKind": "problem",
                    "fromStepVersionId": None,
                    "toStepVersionId": "00000000-0000-4000-8000-000000000004",
                    "fromRaw": old,
                    "toRaw": new,
                },
            }
            result = manager.invoke(validate_request("verify-transition", data))
            record("worker_" + expected, result["status"] == expected, result)
        assert manager.process is not None
        limits = Path(f"/proc/{manager.process.pid}/limits").read_text()
        address = next(
            line for line in limits.splitlines() if line.startswith("Max address space")
        )
        cpu = next(
            line for line in limits.splitlines() if line.startswith("Max cpu time")
        )
        record(
            "linux_address_space_limit_applied",
            str(192 * 1024 * 1024) in address,
            address,
        )
        record("linux_per_request_cpu_soft_limit", cpu.split()[3].isdigit(), cpu)
    finally:
        manager.close()
    print(
        json.dumps(
            {
                "phase": "PH-03",
                "engineVersion": ENGINE_VERSION,
                "python": sys.version,
                "checks": checks,
                "passed": sum(c["passed"] is True for c in checks),
                "failed": 0,
                "scope": (
                    "Local synthetic Linux resource/worker checks; no public port, "
                    "DB, NestJS adapter, load test or gate acceptance"
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
