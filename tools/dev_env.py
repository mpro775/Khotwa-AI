"""Generate local-only ephemeral development secrets without printing their values."""

from pathlib import Path
import secrets

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    target = ROOT / ".local" / "compose.env"
    target.parent.mkdir(parents=True, exist_ok=True)
    values = {
        "POSTGRES_PASSWORD": secrets.token_urlsafe(32),
        "INTERNAL_HEALTH_TOKEN": secrets.token_urlsafe(32),
        "MATH_INTERNAL_TOKEN": secrets.token_urlsafe(32),
        "GUEST_DIGEST_KEY": secrets.token_urlsafe(32),
        "BOOTSTRAP_SIGNING_KEY": secrets.token_urlsafe(32),
        "CSRF_SIGNING_KEY": secrets.token_urlsafe(32),
        "GUEST_ISSUE_KEY": secrets.token_urlsafe(32),
        "IDEMPOTENCY_DIGEST_KEY": secrets.token_urlsafe(32),
        "CURSOR_SIGNING_KEY": secrets.token_urlsafe(32),
    }
    existing = target.read_text(encoding="utf-8") if target.exists() else ""
    present = {
        line.split("=", 1)[0]
        for line in existing.splitlines()
        if "=" in line and not line.startswith("#")
    }
    missing = {key: value for key, value in values.items() if key not in present}
    if not missing:
        print("Existing local configuration preserved.")
        return
    target.write_text(
        existing
        + ("\n" if existing and not existing.endswith("\n") else "")
        + "\n".join(f"{key}={value}" for key, value in missing.items())
        + "\n",
        encoding="utf-8",
    )
    print("Added missing local-only keys; existing values preserved and omitted.")


if __name__ == "__main__":
    main()
