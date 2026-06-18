#!/usr/bin/env python
from __future__ import annotations

import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from reading_digest.cleaner import CleanerPaths, run_clean


def _default_paths(root: Path) -> CleanerPaths:
    return CleanerPaths(
        digest_root=root,
        registry_path=root / "_reading_sources.json",
        notes_dir=root / "Notes",
        pdfs_dir=root / "PDFs",
        runs_dir=root / "Runs",
        digest_path=root / "Reading Digest.md",
        library_path=root / "Reading Library.md",
        sources_path=root / "Reading Sources.md",
        quarantine_path=root / "_quarantine.json",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("digest_root", nargs="?", default=".")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--stuck-days", type=int, default=30)
    args = parser.parse_args()

    paths = _default_paths(Path(args.digest_root).expanduser().resolve())
    result = run_clean(paths, apply=args.apply, stuck_days=args.stuck_days)
    for key, value in sorted(result.issues.items()):
        print(f"{key}: {value}")
    return 0 if not args.check or not result.changed else 1


if __name__ == "__main__":
    raise SystemExit(main())
