from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import re
import secrets
from typing import Any


URL_RE = re.compile(r"<(?P<url>https?://[^>|]+)(?:\|[^>]+)?>|(?P<plain>https?://[^\s>]+)")


@dataclass(frozen=True)
class SlackIngestResult:
    registry: dict[str, Any]
    added_count: int
    last_seen_ts: str | None


def _normalize_url(url: str) -> str:
    return url.rstrip(").,]")


def _extract_urls(text: str) -> list[str]:
    urls: list[str] = []
    for match in URL_RE.finditer(text):
        candidate = match.group("url") or match.group("plain")
        if candidate:
            urls.append(_normalize_url(candidate))
    return urls


def _posted_by(message: dict[str, Any]) -> str:
    profile = message.get("user_profile") or {}
    return profile.get("real_name") or profile.get("display_name") or "unknown"


def _iso_now(now: str | None) -> str:
    if now:
        return now
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def ingest_slack_messages(
    *,
    registry: dict[str, Any],
    messages: list[dict[str, Any]],
    channel_name: str,
    last_seen_ts: str | None,
    now: str | None = None,
) -> SlackIngestResult:
    items = list(registry.get("items", []))
    seen_sources = {_normalize_url(str(item.get("source", ""))) for item in items}
    current_last_seen = last_seen_ts
    added_count = 0
    timestamp = _iso_now(now)

    for message in messages:
        ts = str(message.get("ts", ""))
        if current_last_seen is None or ts > current_last_seen:
            current_last_seen = ts
        if last_seen_ts is not None and ts <= last_seen_ts:
            continue
        urls = _extract_urls(str(message.get("text", "")))
        for url in urls:
            if not url or url in seen_sources:
                continue
            items.append(
                {
                    "item_id": secrets.token_hex(12),
                    "title": url,
                    "abbreviated_title": url[:40],
                    "source": url,
                    "source_kind": "candidate-slack",
                    "origin": "slack-papers-and-more",
                    "discovered_by": "slack-intake",
                    "status": "candidate",
                    "summary_status": "not_started",
                    "workflow_state": "candidate",
                    "coverage": "unknown",
                    "priority": "normal",
                    "relevance_score": 0.0,
                    "manual_rating": None,
                    "manual_tags": ["surgical-informatics-lab"],
                    "note_relpath": None,
                    "pdf_relpath": None,
                    "first_author_last_name": None,
                    "intake_at": None,
                    "added_at": timestamp,
                    "updated_at": timestamp,
                    "read_log": [],
                    "slack_channel": channel_name,
                    "slack_posted_by": _posted_by(message),
                    "slack_ts": ts,
                }
            )
            seen_sources.add(url)
            added_count += 1

    return SlackIngestResult(
        registry={"items": items},
        added_count=added_count,
        last_seen_ts=current_last_seen,
    )

