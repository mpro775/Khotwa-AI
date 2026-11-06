"""Idempotent private synthetic fixture seed; no database changes or publication."""

from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    source = ROOT / "docs" / "14-GOLDEN-DATASET.cases.json"
    dataset = json.loads(source.read_text(encoding="utf-8"))
    payload = {
        "seedVersion": "ph01-synthetic-v1",
        "syntheticOnly": True,
        "sourceDatasetVersion": dataset["dataset_version"],
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "notationProfile": "ar-mashriq-school-v1",
        "learners": [
            {"id": f"demo-learner-{i:03d}", "synthetic": True} for i in range(1, 4)
        ],
        "draftProblems": [
            {**p, "reviewStatus": "unreviewed", "published": False}
            for p in dataset["seed_problems"]
        ],
        "publishedProblems": [],
    }
    data = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    target = ROOT / ".local" / "synthetic-seed.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or target.read_text(encoding="utf-8") != data:
        target.write_text(data, encoding="utf-8")
    print(
        f"Synthetic fixture seed ready: {len(payload['draftProblems'])} unpublished "
        "drafts; no DB or real learners."
    )


if __name__ == "__main__":
    main()
