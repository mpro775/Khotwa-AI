"""Fixed test-only worker for proving OS process termination, never a route."""

import json
import sys
import time

print(json.dumps({"ready": True}), flush=True)
for _ in sys.stdin:
    if sys.argv[1] == "crash":
        sys.exit(3)
    time.sleep(30)
