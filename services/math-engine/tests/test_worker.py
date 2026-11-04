import os
import subprocess
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from helpers import payload
from khotwa_math.protocol import validate_request
from khotwa_math.worker_manager import WorkerManager


class FixtureManager(WorkerManager):
    def __init__(self, mode: str):
        super().__init__(timeout=0.1)
        self.mode = mode

    def launch(self) -> subprocess.Popen[bytes]:
        return subprocess.Popen(
            [
                sys.executable,
                str(Path(__file__).with_name("worker_fixture.py")),
                self.mode,
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )


class WorkerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manager = WorkerManager()
        cls.manager.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.manager.close()

    def test_warm_worker_serves_all_three_operations(self) -> None:
        for operation in ("parse", "verify-transition", "check-final"):
            result = self.manager.invoke(
                validate_request(operation, payload(operation))
            )
            self.assertEqual(
                result.get("parseStatus", result.get("status")),
                "parsed" if operation == "parse" else "verified_valid",
            )

    def test_escaped_surrogate_is_rejected_without_crashing_worker(self) -> None:
        process = self.manager.process
        result = self.manager.invoke(
            validate_request("parse", payload("parse", old="\ud800=٢"))
        )
        self.assertEqual(result["parseStatus"], "syntax_error")
        self.assertEqual(result["reasonCode"], "UNSAFE_CONTROL_CHARACTER")
        self.assertIs(self.manager.process, process)

    def test_start_is_idempotent(self) -> None:
        process = self.manager.process
        self.manager.start()
        self.assertIs(self.manager.process, process)

    def test_actual_hard_timeout_kills_worker(self) -> None:
        manager = FixtureManager("sleep")
        manager.start()
        process = manager.process
        try:
            start = time.monotonic()
            result = manager.invoke(
                validate_request("verify-transition", payload("verify-transition"))
            )
            self.assertLess(time.monotonic() - start, 2)
            self.assertEqual(result["status"], "service_error")
            self.assertEqual(result["reasonCode"], "MATH_TIMEOUT")
            self.assertIsNone(result["evidence"])
            self.assertIsNotNone(process.poll())
        finally:
            manager.close()

    def test_crashed_worker_does_not_issue_invalid_math(self) -> None:
        manager = FixtureManager("crash")
        manager.start()
        try:
            result = manager.invoke(validate_request("parse", payload("parse")))
            self.assertEqual(result["parseStatus"], "service_error")
            self.assertEqual(result["reasonCode"], "MATH_WORKER_FAILED")
            self.assertIsNone(result["ast"])
        finally:
            manager.close()

    def test_busy_is_bounded_and_not_a_student_failure(self) -> None:
        self.manager._lock.acquire()
        try:
            result = self.manager.invoke(
                validate_request("check-final", payload("check-final"))
            )
            self.assertEqual(result["status"], "service_error")
            self.assertEqual(result["reasonCode"], "MATH_BUSY")
            self.assertIsNone(result["solution"])
        finally:
            self.manager._lock.release()

    def test_worker_does_not_inherit_service_secrets(self) -> None:
        with patch.dict(
            os.environ,
            {"MATH_INTERNAL_TOKEN": "synthetic-secret", "DATABASE_URL": "synthetic-db"},
        ):
            with patch("khotwa_math.worker_manager.subprocess.Popen") as launch:
                WorkerManager().launch()
                environment = launch.call_args.kwargs["env"]
                self.assertNotIn("MATH_INTERNAL_TOKEN", environment)
                self.assertNotIn("DATABASE_URL", environment)
                self.assertFalse(launch.call_args.kwargs["shell"])
