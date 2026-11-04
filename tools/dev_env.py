"""Generate local-only ephemeral development secrets without printing their values."""

from pathlib import Path
import secrets

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    target = ROOT / ".local" / "compose.env"
    if target.exists():
        print("Existing local configuration preserved.")
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    values = {
        "POSTGRES_PASSWORD": secrets.token_urlsafe(32),
        "INTERNAL_HEALTH_TOKEN": secrets.token_urlsafe(32),
        "MATH_INTERNAL_TOKEN": secrets.token_urlsafe(32),
    }
    target.write_text(
        "\n".join(f"{key}={value}" for key, value in values.items()) + "\n",
        encoding="utf-8",
    )
    print("Created .local/compose.env with local-only secrets; values omitted.")


if __name__ == "__main__":
    main()
