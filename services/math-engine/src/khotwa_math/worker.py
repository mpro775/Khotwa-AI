"""Fixed JSON-lines worker. No shell, client code, pickle or student credentials."""

import json
import math
import sys
from typing import cast

from .model import Json
from .protocol import execute, validate_request

MEMORY_BYTES = 192 * 1024 * 1024


def memory_limit() -> None:
    if sys.platform == "linux":
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (MEMORY_BYTES, MEMORY_BYTES))


def cpu_limit() -> None:
    if sys.platform == "linux":
        import resource

        used = resource.getrusage(resource.RUSAGE_SELF)
        seconds = math.ceil(used.ru_utime + used.ru_stime + 1)
        resource.setrlimit(resource.RLIMIT_CPU, (seconds, resource.RLIM_INFINITY))


def emit(value: object) -> None:
    sys.stdout.buffer.write(
        json.dumps(value, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
        + b"\n"
    )
    sys.stdout.buffer.flush()


def main() -> None:
    memory_limit()
    # Warm imports occur before ready and outside the per-request deadline.
    from . import engine  # noqa: F401

    assert engine is not None
    emit(
        {
            "ready": True,
            "memoryLimitBytes": MEMORY_BYTES if sys.platform == "linux" else None,
        }
    )
    while True:
        line = sys.stdin.buffer.readline(8193)
        if not line:
            return
        if len(line) > 8192:
            return
        envelope = json.loads(line)
        operation = envelope["operation"]
        payload = cast(Json, envelope["payload"])
        cpu_limit()
        request = validate_request(operation, payload)
        emit(execute(request))


if __name__ == "__main__":
    main()
