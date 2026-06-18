#!/usr/bin/env python
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from reading_digest.slack import ingest_slack_messages


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("registry_file")
    parser.add_argument("messages_file")
    parser.add_argument("--channel", default="papers-and-more")
    parser.add_argument("--last-seen-ts")
    args = parser.parse_args()

    registry = json.loads(Path(args.registry_file).read_text())
    messages = json.loads(Path(args.messages_file).read_text())
    result = ingest_slack_messages(
        registry=registry,
        messages=messages,
        channel_name=args.channel,
        last_seen_ts=args.last_seen_ts,
    )
    print(json.dumps({"added_count": result.added_count, "last_seen_ts": result.last_seen_ts}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
