from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import re
import tempfile
import urllib.parse
from typing import Any


STATUS_MAP = {
    "to read": "to_read",
    "to_read": "to_read",
    "reading": "reading",
    "read summary": "read_summary",
    "read_summary": "read_summary",
    "need deeper": "need_deeper",
    "need_deeper": "need_deeper",
    "read": "read",
    "archived": "archived",
    "candidate": "candidate",
}
SUMMARY_STATUS_MAP = {
    "generated": "generated",
    "needs text": "needs_text",
    "needs_text": "needs_text",
    "needs full text": "needs_full_text",
    "needs_full_text": "needs_full_text",
    "needs regeneration": "needs_regeneration",
    "needs_regeneration": "needs_regeneration",
    "codex failed": "codex_failed",
    "codex_failed": "codex_failed",
    "not started": "not_started",
    "not_started": "not_started",
}
PRIORITY_MAP = {"high": "high", "normal": "normal", "low": "low"}
STATUS_ORDER = [
    "to_read",
    "candidate",
    "reading",
    "read_summary",
    "need_deeper",
    "read",
    "archived",
]
STATUS_LABELS = {
    "to_read": "To Read",
    "candidate": "Candidate",
    "reading": "Reading",
    "read_summary": "Read Summary",
    "need_deeper": "Need Deeper",
    "read": "Read",
    "archived": "Archived",
}
JUNK_TITLE_RE = re.compile(
    r"^(?:10\.\S+|\d{4}\.\d{4,5}(?:v\d+)?|[a-z]+(?:\.[a-z0-9]+)+|\w+\.(?:pdf|md))$",
    re.IGNORECASE,
)
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?", re.DOTALL)


@dataclass(frozen=True)
class CleanerPaths:
    digest_root: Path
    registry_path: Path
    notes_dir: Path
    pdfs_dir: Path
    runs_dir: Path
    digest_path: Path
    library_path: Path
    sources_path: Path
    quarantine_path: Path


@dataclass(frozen=True)
class CleanResult:
    registry: dict[str, Any]
    quarantine: dict[str, Any]
    digest_text: str
    library_text: str
    sources_text: str
    note_updates: dict[str, str]
    report: dict[str, Any]
    issues: dict[str, int]
    changed: bool


def _now(now: str | None) -> datetime:
    if now:
        return datetime.fromisoformat(now.replace("Z", "+00:00"))
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text()) if path.exists() else {"items": []}


def _merge_quarantine(existing: list[dict[str, Any]], new: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    ordered_ids: list[str] = []
    for item in existing + new:
        item_id = str(item.get("item_id") or "")
        if item_id not in merged:
            ordered_ids.append(item_id)
        merged[item_id] = item
    return [merged[item_id] for item_id in ordered_ids]


def _write_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False) as handle:
        handle.write(text)
        temp_path = Path(handle.name)
    os.replace(temp_path, path)


def _normalize_enum(value: Any, mapping: dict[str, str]) -> str | Any:
    if value is None:
        return value
    key = str(value).strip().lower().replace("-", "_")
    key = " ".join(key.split()).replace(" ", "_")
    return mapping.get(key, mapping.get(str(value).strip().lower(), key))


def _workflow_state(status: str | None, summary_status: str | None) -> str | None:
    if status == "candidate":
        return "candidate"
    if summary_status in {"codex_failed", "needs_regeneration"}:
        return "failed"
    if summary_status == "generated":
        return "summarized"
    if summary_status in {"needs_text", "needs_full_text"}:
        return "queued"
    if summary_status == "not_started":
        return "queued" if status == "to_read" else "candidate"
    return None


def _normalize_title(value: str) -> str:
    lowered = value.lower()
    lowered = re.sub(r"[^a-z0-9]+", " ", lowered)
    return " ".join(lowered.split())


def _normalized_key(item: dict[str, Any]) -> str:
    doi = str(item.get("doi") or "").strip().lower()
    if doi:
        return f"doi:{doi}"
    source = str(item.get("source") or "")
    arxiv_match = re.search(r"(\d{4}\.\d{4,5}(?:v\d+)?)", source)
    if arxiv_match:
        return f"arxiv:{arxiv_match.group(1).lower()}"
    title = _normalize_title(str(item.get("title") or ""))
    return f"title:{title}"


def _richness(item: dict[str, Any]) -> int:
    score = 0
    for key, value in item.items():
        if value not in (None, "", [], {}):
            score += 1
    score += len(item.get("manual_tags", []))
    score += len(item.get("read_log", []))
    return score


def _merge_items(items: list[dict[str, Any]]) -> dict[str, Any]:
    primary = max(items, key=_richness)
    merged = dict(primary)
    tags = set(primary.get("manual_tags", []))
    read_log: list[Any] = list(primary.get("read_log", []))
    seen_logs = {json.dumps(entry, sort_keys=True) for entry in read_log}
    for item in items:
        tags.update(item.get("manual_tags", []))
        for entry in item.get("read_log", []):
            key = json.dumps(entry, sort_keys=True)
            if key not in seen_logs:
                read_log.append(entry)
                seen_logs.add(key)
        for field, value in item.items():
            if merged.get(field) in (None, "", [], {}) and value not in (None, "", [], {}):
                merged[field] = value
    merged["manual_tags"] = sorted(tags)
    merged["read_log"] = read_log
    return merged


def _is_junk_title(title: str) -> bool:
    stripped = title.strip()
    if stripped == "Example Article":
        return True
    return bool(JUNK_TITLE_RE.fullmatch(stripped))


def _decode_file_url(url: str) -> str:
    if url.startswith("file://"):
        return urllib.parse.unquote(url[7:])
    return url


def _rewrite_link(value: Any, digest_root: Path, kind: str) -> Any:
    if value in (None, ""):
        return value
    text = _decode_file_url(str(value))
    root_marker = str(digest_root)
    if root_marker in text:
        text = text.split(root_marker, 1)[1].lstrip("/\\")
    if kind == "note":
        if "Notes/" in text:
            name = Path(text).name
            return f"Notes/{name}"
    if kind == "pdf":
        if "PDFs/" in text:
            name = Path(text).name
            return f"PDFs/{name}"
    if kind == "source":
        if "Notes/" in text and text.endswith(".md"):
            return f"[[Notes/{Path(text).name}]]"
        if "PDFs/" in text and text.endswith(".pdf"):
            return f"[[PDFs/{Path(text).name}]]"
        if text.endswith(".md"):
            return f"[[{Path(text).stem}]]"
        if text.endswith(".pdf"):
            return f"[[{Path(text).name}]]"
    return value


def _parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}, text
    frontmatter: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, raw = line.split(":", 1)
        frontmatter[key.strip()] = raw.strip().strip('"')
    body = text[match.end() :]
    return frontmatter, body


def _serialize_frontmatter(item: dict[str, Any], body: str) -> str:
    ordered = [
        ("title", item.get("title")),
        ("source", item.get("source")),
        ("source_kind", item.get("source_kind")),
        ("origin", item.get("origin")),
        ("status", item.get("status")),
        ("summary_status", item.get("summary_status")),
        ("workflow_state", item.get("workflow_state")),
        ("coverage", item.get("coverage")),
        ("priority", item.get("priority")),
        ("note_relpath", item.get("note_relpath")),
        ("pdf_relpath", item.get("pdf_relpath")),
        ("intake_at", item.get("intake_at")),
        ("added_at", item.get("added_at")),
        ("updated_at", item.get("updated_at")),
    ]
    lines = ["---"]
    for key, value in ordered:
        if value in (None, ""):
            continue
        lines.append(f'{key}: "{value}"')
    tags = item.get("manual_tags", [])
    if tags:
        lines.append("manual_tags:")
        for tag in tags:
            lines.append(f'  - "{tag}"')
    lines.append("---")
    cleaned_body = body.lstrip("\n")
    return "\n".join(lines) + "\n\n" + cleaned_body


def _date_or_min(value: str | None) -> tuple[int, str]:
    if not value:
        return (0, "")
    return (1, value)


def _sort_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def sort_key(item: dict[str, Any]) -> tuple[int, int, float, tuple[int, str]]:
        status = item.get("status")
        try:
            status_index = STATUS_ORDER.index(status)
        except ValueError:
            status_index = len(STATUS_ORDER)
        priority_score = {"high": 2, "normal": 1, "low": 0}.get(item.get("priority"), 1)
        relevance = float(item.get("relevance_score") or 0.0)
        return (status_index, -priority_score, -relevance, _date_or_min(item.get("added_at")))

    return sorted(items, key=sort_key)


def _build_sources_view(items: list[dict[str, Any]]) -> str:
    lines = [
        "# Reading Sources",
        "",
        "> [!info] Source of truth",
        "> Canonical registry is `_reading_sources.json`. This note is a generated view.",
        "",
    ]
    grouped: dict[str, list[dict[str, Any]]] = {status: [] for status in STATUS_ORDER}
    for item in _sort_items(items):
        grouped.setdefault(item.get("status"), []).append(item)
    for status in STATUS_ORDER:
        bucket = grouped.get(status, [])
        if not bucket:
            continue
        lines.append(f"## {STATUS_LABELS[status]} ({len(bucket)})")
        for item in bucket:
            note_link = ""
            if item.get("note_relpath"):
                note_link = Path(str(item["note_relpath"])).stem
            display = note_link or item.get("title") or "Untitled"
            lines.append(f"- [[{display}]]")
            lines.append(f"  - Source: {item.get('source')}")
            lines.append(f"  - Status: {item.get('status')}")
            lines.append(f"  - Summary: {item.get('summary_status')}")
            lines.append(f"  - Priority: {item.get('priority')}")
            lines.append(f"  - Coverage: {item.get('coverage')}")
            lines.append(f"  - Origin: {item.get('origin')}")
            if item.get("manual_tags"):
                lines.append(f"  - Tags: {', '.join(item['manual_tags'])}")
            if item.get("relevance_score") is not None:
                lines.append(f"  - Relevance: {float(item.get('relevance_score', 0.0)):.3f}")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _build_library_view(items: list[dict[str, Any]]) -> str:
    return _build_sources_view(items)


def _rewrite_digest_links(digest_text: str, items: list[dict[str, Any]]) -> tuple[str, int]:
    changes = 0
    by_title = {str(item.get("title")): item for item in items}
    lines = digest_text.splitlines()
    active_item: dict[str, Any] | None = None
    output: list[str] = []
    for line in lines:
        if line.startswith("### "):
            active_item = by_title.get(line[4:].strip().strip('"'))
        if line.strip() == "[[]]" and active_item and active_item.get("note_relpath"):
            line = f"[[{Path(str(active_item['note_relpath'])).stem}]]"
            changes += 1
        elif line.strip() == "[[]]":
            line = ""
            changes += 1
        output.append(line)
    return "\n".join(output).rstrip() + "\n", changes


def _report_markdown(report: dict[str, Any], issues: dict[str, int]) -> str:
    lines = ["# Reading Digest Clean Report", ""]
    lines.append("## Auto-fix counts")
    for key in sorted(issues):
        lines.append(f"- {key}: {issues[key]}")
    lines.append("")
    lines.append("## Stuck candidates")
    if report["stuck_candidates"]:
        for item in report["stuck_candidates"]:
            lines.append(f"- {item['item_id']}: {item['title']}")
    else:
        lines.append("- none")
    lines.append("")
    lines.append("## Orphan notes (no registry match — review)")
    if report.get("orphan_notes"):
        for relpath in report["orphan_notes"]:
            lines.append(f"- {relpath}")
    else:
        lines.append("- none")
    lines.append("")
    lines.append("## Prompt improvement proposals")
    for proposal in report["prompt_proposals"]:
        lines.append(f"- {proposal}")
    lines.append("")
    return "\n".join(lines)


def _prompt_proposals() -> list[str]:
    return [
        "paper-finder.md: emit canonical underscore statuses and add Consensus search with dedupe.",
        "paper-resolver.md: derive real titles from metadata before falling back to DOI/arXiv identifiers.",
        "daily-recommender.md: render note wikilinks from note_relpath instead of empty placeholders.",
        "note-generator.md: write workflow_state and canonical relative note/pdf paths.",
    ]


def _build_stub_item(note_path: Path, frontmatter: dict[str, str], timestamp: str) -> dict[str, Any]:
    digest = hashlib.sha1(str(note_path).encode("utf-8")).hexdigest()[:24]
    title = frontmatter.get("title") or note_path.stem.replace("-", " ").title()
    return {
        "item_id": digest,
        "title": title,
        "abbreviated_title": title[:40],
        "source": frontmatter.get("source"),
        "source_kind": frontmatter.get("source_kind", "vault-note"),
        "origin": frontmatter.get("origin", "cleaner-reconciliation"),
        "status": _normalize_enum(frontmatter.get("status", "to_read"), STATUS_MAP),
        "summary_status": _normalize_enum(frontmatter.get("summary_status", "generated"), SUMMARY_STATUS_MAP),
        "coverage": frontmatter.get("coverage", "full"),
        "priority": _normalize_enum(frontmatter.get("priority", "normal"), PRIORITY_MAP),
        "workflow_state": _workflow_state(
            _normalize_enum(frontmatter.get("status", "to_read"), STATUS_MAP),
            _normalize_enum(frontmatter.get("summary_status", "generated"), SUMMARY_STATUS_MAP),
        ),
        "relevance_score": 0.0,
        "manual_rating": None,
        "manual_tags": [],
        "note_relpath": f"Notes/{note_path.name}",
        "pdf_relpath": None,
        "first_author_last_name": None,
        "intake_at": None,
        "added_at": timestamp,
        "updated_at": timestamp,
        "read_log": [],
    }


def run_clean(
    paths: CleanerPaths,
    *,
    apply: bool = False,
    now: str | None = None,
    stuck_days: int = 30,
) -> CleanResult:
    timestamp = _now(now)
    timestamp_iso = _iso(timestamp)
    issues: dict[str, int] = {
        "enum_normalization": 0,
        "workflow_state_repaired": 0,
        "duplicates_merged": 0,
        "junk_flagged": 0,
        "links_rewritten": 0,
        "frontmatter_canonicalized": 0,
        "missing_notes_flagged": 0,
        "orphan_notes_flagged": 0,
        "views_regenerated": 0,
        "idempotence_clean": 0,
    }

    original_registry = _read_json(paths.registry_path)
    original_quarantine = _read_json(paths.quarantine_path)
    items = [dict(item) for item in original_registry.get("items", [])]

    for item in items:
        for field, mapping in (
            ("status", STATUS_MAP),
            ("summary_status", SUMMARY_STATUS_MAP),
            ("priority", PRIORITY_MAP),
        ):
            normalized = _normalize_enum(item.get(field), mapping)
            if normalized != item.get(field):
                item[field] = normalized
                issues["enum_normalization"] += 1
        workflow = _workflow_state(item.get("status"), item.get("summary_status"))
        if workflow and workflow != item.get("workflow_state"):
            item["workflow_state"] = workflow
            issues["workflow_state_repaired"] += 1

    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in items:
        grouped.setdefault(_normalized_key(item), []).append(item)
    deduped: list[dict[str, Any]] = []
    for bucket in grouped.values():
        if len(bucket) > 1:
            issues["duplicates_merged"] += len(bucket) - 1
            deduped.append(_merge_items(bucket))
        else:
            deduped.extend(bucket)
    items = deduped

    quarantine_items: list[dict[str, Any]] = []
    filtered_items: list[dict[str, Any]] = []
    for item in items:
        title = str(item.get("title") or "")
        if title.strip() == "Example Article":
            archived = dict(item)
            archived["status"] = "archived"
            archived["quarantine_reason"] = "example_row"
            quarantine_items.append(archived)
            issues["junk_flagged"] += 1
            continue
        if not _is_junk_title(title):
            filtered_items.append(item)
            continue
        source = str(item.get("source") or "").strip()
        if source:
            if item.get("summary_status") != "needs_regeneration":
                item["summary_status"] = "needs_regeneration"
                issues["junk_flagged"] += 1
            item["needs_title"] = True
            item["workflow_state"] = _workflow_state(item.get("status"), item.get("summary_status"))
            filtered_items.append(item)
            continue
        archived = dict(item)
        archived["status"] = "archived"
        archived["quarantine_reason"] = "junk_title_without_source"
        quarantine_items.append(archived)
        issues["junk_flagged"] += 1
    items = filtered_items

    note_path_to_item: dict[str, dict[str, Any]] = {}
    for item in items:
        source = item.get("source")
        rewritten_source = _rewrite_link(source, paths.digest_root, "source")
        if rewritten_source != source:
            item["source"] = rewritten_source
            issues["links_rewritten"] += 1
        note_relpath = item.get("note_relpath")
        rewritten_note = _rewrite_link(note_relpath, paths.digest_root, "note")
        if rewritten_note != note_relpath:
            item["note_relpath"] = rewritten_note
            issues["links_rewritten"] += 1
        pdf_relpath = item.get("pdf_relpath")
        rewritten_pdf = _rewrite_link(pdf_relpath, paths.digest_root, "pdf")
        if rewritten_pdf != pdf_relpath:
            item["pdf_relpath"] = rewritten_pdf
            issues["links_rewritten"] += 1
        if item.get("note_relpath"):
            note_path_to_item[str(item["note_relpath"])] = item

    digest_text_original = paths.digest_path.read_text() if paths.digest_path.exists() else "# Reading Digest\n"
    digest_text, digest_changes = _rewrite_digest_links(digest_text_original, items)
    issues["links_rewritten"] += digest_changes

    note_updates: dict[str, str] = {}
    existing_notes = sorted(paths.notes_dir.glob("*.md")) if paths.notes_dir.exists() else []
    seen_note_relpaths = set()
    for note_path in existing_notes:
        relpath = f"Notes/{note_path.name}"
        seen_note_relpaths.add(relpath)
        note_text = note_path.read_text()
        frontmatter, body = _parse_frontmatter(note_text)
        item = note_path_to_item.get(relpath)
        if not item:
            continue
        updated = _serialize_frontmatter(item, body)
        if updated != note_text:
            note_updates[note_path.name] = updated
            issues["frontmatter_canonicalized"] += 1

    for item in items:
        relpath = item.get("note_relpath")
        if relpath and relpath not in seen_note_relpaths:
            if item.get("summary_status") != "needs_full_text":
                item["summary_status"] = "needs_full_text"
                item["workflow_state"] = _workflow_state(item.get("status"), item.get("summary_status"))
                issues["missing_notes_flagged"] += 1

    # Notes whose corresponding registry item cannot be matched are FLAGGED in the
    # report, not stubbed into the registry. Note filenames are not reliable slugs of
    # titles (they are a mix of raw titles, URL-derived slugs, and identifiers), so
    # auto-stubbing creates duplicate rows and is non-idempotent. Flagging is the
    # spec-sanctioned alternative ("create stub OR flag") and keeps the pass idempotent.
    known_relpaths = {str(item.get("note_relpath")) for item in items if item.get("note_relpath")}
    orphan_notes: list[str] = []
    for note_path in existing_notes:
        relpath = f"Notes/{note_path.name}"
        if relpath in known_relpaths:
            continue
        orphan_notes.append(relpath)
        issues["orphan_notes_flagged"] += 1

    items = _sort_items(items)
    library_text = _build_library_view(items)
    sources_text = _build_sources_view(items)
    if library_text != (paths.library_path.read_text() if paths.library_path.exists() else ""):
        issues["views_regenerated"] += 1
    if sources_text != (paths.sources_path.read_text() if paths.sources_path.exists() else ""):
        issues["views_regenerated"] += 1

    stuck_candidates: list[dict[str, Any]] = []
    for item in items:
        if item.get("status") != "candidate" or item.get("summary_status") != "not_started":
            continue
        added_at = item.get("added_at")
        if not added_at:
            continue
        age_days = (timestamp - datetime.fromisoformat(str(added_at).replace("Z", "+00:00"))).days
        if age_days >= stuck_days:
            stuck_candidates.append(
                {"item_id": item["item_id"], "title": item.get("title"), "age_days": age_days}
            )

    report = {
        "stuck_candidates": stuck_candidates,
        "orphan_notes": orphan_notes,
        "prompt_proposals": _prompt_proposals(),
    }
    report_text = _report_markdown(report, issues)
    report_path = paths.runs_dir / f"clean-{timestamp.date().isoformat()}.md"

    registry_payload = {"items": items}
    quarantine_payload = {
        "items": _merge_quarantine(
            [dict(item) for item in original_quarantine.get("items", [])],
            quarantine_items,
        )
    }
    changed = any(
        [
            registry_payload != original_registry,
            digest_text != digest_text_original,
            library_text != (paths.library_path.read_text() if paths.library_path.exists() else ""),
            sources_text != (paths.sources_path.read_text() if paths.sources_path.exists() else ""),
            bool(note_updates),
            quarantine_payload != original_quarantine,
        ]
    )
    if not changed:
        issues["idempotence_clean"] = 1

    if apply:
        if paths.registry_path.exists():
            backup_path = paths.registry_path.with_suffix(".json.bak")
            backup_path.write_text(paths.registry_path.read_text())
        _write_atomic(paths.registry_path, json.dumps(registry_payload, indent=2) + "\n")
        _write_atomic(paths.quarantine_path, json.dumps(quarantine_payload, indent=2) + "\n")
        _write_atomic(paths.digest_path, digest_text)
        _write_atomic(paths.library_path, library_text)
        _write_atomic(paths.sources_path, sources_text)
        for filename, text in note_updates.items():
            _write_atomic(paths.notes_dir / filename, text)
        _write_atomic(report_path, report_text)

    return CleanResult(
        registry=registry_payload,
        quarantine=quarantine_payload,
        digest_text=digest_text,
        library_text=library_text,
        sources_text=sources_text,
        note_updates=note_updates,
        report=report,
        issues=issues,
        changed=changed,
    )
