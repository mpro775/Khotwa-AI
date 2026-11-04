"""One warm worker, bounded concurrency and a parent-enforced hard deadline."""

import json
import os
import queue
import subprocess
import sys
import threading
from pathlib import Path
from typing import BinaryIO, cast

from . import NOTATION_VERSION

from .model import Json, MathFailure, Object
from .protocol import Request, failure_response

MAX_RESPONSE = 65536


class WorkerManager:
    def __init__(self, timeout: float = 1.0) -> None:
        self.timeout = timeout
        self._lock = threading.Lock()
        self._messages: queue.Queue[bytes] = queue.Queue(maxsize=2)
        self.process: subprocess.Popen[bytes] | None = None
        self.ready = False
        self.runtime_details: Object = {}
        self._closed = False

    def launch(self) -> subprocess.Popen[bytes]:
        environment = {
            k: os.environ[k]
            for k in ("SYSTEMROOT", "WINDIR", "PATH", "TEMP", "TMP", "LANG", "LC_ALL")
            if k in os.environ
        }
        environment.update(
            {
                "PYTHONPATH": str(Path(__file__).resolve().parent.parent),
                "PYTHONIOENCODING": "utf-8",
                "PYTHONDONTWRITEBYTECODE": "1",
            }
        )
        return subprocess.Popen(
            [sys.executable, "-m", "khotwa_math.worker"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            env=environment,
            shell=False,
            close_fds=True,
        )

    @staticmethod
    def read_messages(stream: BinaryIO, messages: queue.Queue[bytes]) -> None:
        while True:
            data = stream.readline(MAX_RESPONSE + 1)
            try:
                messages.put(data, timeout=1)
            except queue.Full:
                return
            if not data or len(data) > MAX_RESPONSE:
                return

    def start(self) -> None:
        with self._lock:
            self._start_locked()

    def _start_locked(self) -> None:
        if self._closed:
            return
        if self.ready and self.process is not None and self.process.poll() is None:
            return
        self.ready = False
        self._messages = queue.Queue(maxsize=2)
        self.process = self.launch()
        assert self.process.stdout is not None
        threading.Thread(
            target=self.read_messages,
            args=(self.process.stdout, self._messages),
            daemon=True,
        ).start()
        try:
            message = json.loads(self._messages.get(timeout=15))
            if message.get("ready") is not True:
                raise RuntimeError("worker initialization failed")
            self.runtime_details = message
            self.ready = True
        except Exception:
            self._stop_locked()
            raise RuntimeError("worker initialization failed") from None

    def _stop_locked(self) -> None:
        self.ready = False
        process, self.process = self.process, None
        if process is None:
            return
        if process.poll() is None:
            process.kill()
        process.wait(timeout=2)
        for stream in (process.stdin, process.stdout):
            if stream is not None:
                stream.close()

    def _restart(self) -> None:
        try:
            self.start()
        except Exception:
            pass  # Health reports unavailable; no raw source/traceback is logged.

    def invoke(self, request: Request) -> Object:
        if request.context["notationProfile"] != NOTATION_VERSION:
            return failure_response(
                request,
                MathFailure(
                    "service_error",
                    "NOTATION_PROFILE_MISMATCH",
                    "نسخة الاصطلاح المطلوبة غير متاحة في هذا المحرك.",
                ),
            )
        if not self.ready or not self._lock.acquire(blocking=False):
            return failure_response(
                request,
                MathFailure(
                    "service_error",
                    "MATH_BUSY",
                    "محرك التحقق غير متاح الآن. أعد المحاولة.",
                ),
            )
        restart = False
        try:
            if self.process is None or self.process.poll() is not None:
                raise RuntimeError("worker exited")
            assert self.process.stdin is not None
            data = (
                json.dumps(
                    {"operation": request.operation, "payload": request.value},
                    ensure_ascii=True,
                ).encode("utf-8")
                + b"\n"
            )
            self.process.stdin.write(data)
            self.process.stdin.flush()
            output = self._messages.get(timeout=self.timeout)
            if not output or len(output) > MAX_RESPONSE:
                raise RuntimeError("invalid worker response")
            result = cast(Json, json.loads(output))
            if not isinstance(result, dict):
                raise RuntimeError("invalid worker response")
            return result
        except Exception as exc:
            code = (
                "MATH_TIMEOUT" if isinstance(exc, queue.Empty) else "MATH_WORKER_FAILED"
            )
            self._stop_locked()
            restart = True
            return failure_response(
                request,
                MathFailure(
                    "service_error", code, "تعذر التحقق الآن؛ لم يصدر حكم على خطوتك."
                ),
            )
        finally:
            self._lock.release()
            if restart and not self._closed:
                threading.Thread(target=self._restart, daemon=True).start()

    def close(self) -> None:
        self._closed = True
        with self._lock:
            self._stop_locked()
