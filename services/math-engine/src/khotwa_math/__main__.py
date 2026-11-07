"""Private math-internal-v1 HTTP transport; never a browser-facing backend."""

import hmac
import json
import os
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.metadata import version
from typing import cast

from . import ENGINE_VERSION, NOTATION_VERSION, WIRE_VERSION
from .model import Json
from .protocol import ContractError, ROUTES, validate_request
from .physics import verify_physics
from .worker_manager import WorkerManager

MAX_BODY_BYTES = 8192


def strict_json(data: bytes) -> Json:
    def pairs(items: list[tuple[str, Json]]) -> dict[str, Json]:
        result: dict[str, Json] = {}
        for key, value in items:
            if key in result:
                raise ContractError("invalid_json")
            result[key] = value
        return result

    def reject_number(_value: str) -> None:
        raise ContractError("invalid_json")

    return cast(
        Json,
        json.loads(
            data.decode("utf-8"),
            object_pairs_hook=pairs,
            parse_float=reject_number,
            parse_constant=reject_number,
        ),
    )


class BoundedServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], handler: type[BaseHTTPRequestHandler]):
        self.slots = threading.BoundedSemaphore(8)
        super().__init__(address, handler)

    def get_request(self) -> tuple[socket.socket, tuple[str, int]]:
        connection, address = super().get_request()
        connection.settimeout(2)
        return connection, address

    def process_request(
        self, request: socket.socket, client_address: tuple[str, int]
    ) -> None:
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(
        self, request: socket.socket, client_address: tuple[str, int]
    ) -> None:
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()


class MathHandler(BaseHTTPRequestHandler):
    token: str = ""
    manager: WorkerManager | None = None

    def authorized(self) -> bool:
        return hmac.compare_digest(
            self.headers.get("Authorization", "").encode("utf-8"),
            ("Bearer " + self.token).encode("utf-8"),
        )

    def do_GET(self) -> None:
        if not self.authorized():
            self.respond(403, {"error": "forbidden"})
            return
        if self.path != "/internal/health":
            self.respond(404, {"error": "not_found"})
            return
        ready = self.manager is not None and self.manager.ready
        self.respond(
            200 if ready else 503,
            {
                "status": "ok" if ready else "unavailable",
                "service": "khotwa-math",
                "sympyVersion": version("sympy"),
                "verificationImplemented": True,
                "engineVersion": ENGINE_VERSION,
                "schemaVersion": WIRE_VERSION,
                "notationProfileVersion": NOTATION_VERSION,
                "workerReady": ready,
            },
        )

    def do_POST(self) -> None:
        self.close_connection = True
        if not self.authorized():
            self.respond(403, {"error": "forbidden"})
            return
        operation = (
            "physics"
            if self.path == "/internal/v1/physics/verify"
            else ROUTES.get(self.path)
        )
        if operation is None:
            self.respond(404, {"error": "not_found"})
            return
        if self.headers.get("Cookie") or self.headers.get("Transfer-Encoding"):
            self.respond(400, {"error": "invalid_request"})
            return
        if (
            not self.headers.get("Content-Type", "")
            .lower()
            .startswith("application/json")
        ):
            self.respond(415, {"error": "json_required"})
            return
        try:
            length = int(self.headers.get("Content-Length", "-1"))
            if length < 0:
                self.respond(411, {"error": "length_required"})
                return
            if length > MAX_BODY_BYTES:
                self.respond(413, {"error": "request_too_large"})
                return
            data = self.rfile.read(length)
            if len(data) != length:
                raise ContractError("invalid_request")
            decoded = strict_json(data)
            if operation == "physics":
                # The separate fixed formula/unit grammar performs a bounded
                # number of rational operations, never arbitrary expressions.
                self.respond(200, verify_physics(decoded))
                return
            request = validate_request(operation, decoded)
            if self.manager is None:
                self.respond(503, {"error": "math_unavailable"})
                return
            self.respond(200, self.manager.invoke(request))
        except ContractError as exc:
            self.respond(400, {"error": str(exc)})
        except (ValueError, UnicodeError, RecursionError):
            self.respond(400, {"error": "invalid_json"})
        except (OSError, TimeoutError):
            self.respond(408, {"error": "request_timeout"})
        except Exception:
            self.respond(500, {"error": "internal_failure"})

    def respond(self, status: int, value: object) -> None:
        data = json.dumps(value, ensure_ascii=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args: object) -> None:
        pass


def main() -> None:
    token = os.environ.get("MATH_INTERNAL_TOKEN", "")
    if len(token) < 32:
        raise SystemExit("MATH_INTERNAL_TOKEN must contain at least 32 characters")
    version("sympy")
    manager = WorkerManager()
    manager.start()
    MathHandler.token = token
    MathHandler.manager = manager
    server = BoundedServer(
        (
            os.environ.get("MATH_ENGINE_HOST", "127.0.0.1"),
            int(os.environ.get("MATH_ENGINE_PORT", "8001")),
        ),
        MathHandler,
    )
    try:
        server.serve_forever()
    finally:
        server.server_close()
        manager.close()


if __name__ == "__main__":
    main()
