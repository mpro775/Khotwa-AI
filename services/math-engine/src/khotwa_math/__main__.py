"""Private, authenticated health endpoint; mathematics starts in PH-03."""

import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.metadata import version


class HealthHandler(BaseHTTPRequestHandler):
    token: str = ""

    def do_GET(self) -> None:
        if self.path != "/internal/health":
            self.respond(404, {"error": "not_found"})
            return
        if not hmac.compare_digest(
            self.headers.get("Authorization", "").encode("utf-8"),
            ("Bearer " + self.token).encode("utf-8"),
        ):
            self.respond(403, {"error": "forbidden"})
            return
        self.respond(
            200,
            {
                "status": "ok",
                "service": "khotwa-math",
                "sympyVersion": version("sympy"),
                "verificationImplemented": False,
            },
        )

    def respond(self, status: int, value: dict[str, object]) -> None:
        data = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args: object) -> None:
        pass


def main() -> None:
    token = os.environ.get("MATH_INTERNAL_TOKEN", "")
    if len(token) < 32:
        raise SystemExit("MATH_INTERNAL_TOKEN must contain at least 32 characters")
    version("sympy")
    HealthHandler.token = token
    server = ThreadingHTTPServer(
        (
            os.environ.get("MATH_ENGINE_HOST", "127.0.0.1"),
            int(os.environ.get("MATH_ENGINE_PORT", "8001")),
        ),
        HealthHandler,
    )
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
