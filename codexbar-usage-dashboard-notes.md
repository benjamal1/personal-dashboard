# CodexBar Usage Data Notes for Personal Dashboard

Date: 2026-05-22

This note captures how the current GNOME CodexBar setup works and what to reuse when building a personal dashboard for Claude/Codex usage, pace, and runout predictions.

## Current Working Setup

The installed CodexBar CLI is here:

```bash
/home/bcjamal/.local/bin/codexbar
```

The shared CodexBar config is here:

```bash
/home/bcjamal/.codexbar/config.json
```

The GNOME extension is here:

```bash
/home/bcjamal/.local/share/gnome-shell/extensions/codexbar@inled.es/
```

Important extension files:

```bash
/home/bcjamal/.local/share/gnome-shell/extensions/codexbar@inled.es/extension.js
/home/bcjamal/.local/share/gnome-shell/extensions/codexbar@inled.es/stylesheet.css
/home/bcjamal/.local/share/gnome-shell/extensions/codexbar@inled.es/schemas/org.gnome.shell.extensions.codexbar.gschema.xml
```

The active provider commands are stored in GSettings:

```bash
gsettings --schemadir /home/bcjamal/.local/share/gnome-shell/extensions/codexbar@inled.es/schemas \
  get org.gnome.shell.extensions.codexbar providers
```

They currently point through a wrapper:

```bash
/home/bcjamal/.local/bin/codexbar-gnome-wrapper --provider claude --format json
/home/bcjamal/.local/bin/codexbar-gnome-wrapper --provider codex --format json
```

The wrapper exists because the GNOME extension needed cleaner text output for pace parsing.

## Reliable CLI Commands

For JSON usage data:

```bash
/home/bcjamal/.local/bin/codexbar usage --provider claude --source cli --format json
/home/bcjamal/.local/bin/codexbar usage --provider codex --source cli --format json
```

For human-readable text data with pace/runout prediction:

```bash
/home/bcjamal/.local/bin/codexbar usage --provider claude --source cli --format text
/home/bcjamal/.local/bin/codexbar usage --provider codex --source cli --format text
```

Important: use `--source cli` on Linux. Do not use `--source auto`; it can try browser-cookie/web support that only works on macOS.

## Why Both JSON and Text Matter

CodexBar JSON contains structured usage values, reset times, account email, and provider metadata.

CodexBar text contains the prediction line that JSON does not expose:

```text
Pace: 12% in deficit | Expected 80% used | Runs out in 11h 38m
Pace: 6% in reserve | Expected 42% used | Lasts until reset
```

For a dashboard, collect both:

1. Run JSON for bars, percentages, reset timestamps, and account data.
2. Run text for the `Pace:` line.
3. Merge them into one internal model.

## Wrapper Behavior

Wrapper path:

```bash
/home/bcjamal/.local/bin/codexbar-gnome-wrapper
```

For `--format text`, it normalizes CodexBar output down to three easy-to-parse lines:

```text
Session: ...
Weekly: ...
Pace: ...
```

This is useful for dashboards too. It avoids brittle parsing of progress bars, credits, account lines, and extra CLI noise.

Example:

```bash
/home/bcjamal/.local/bin/codexbar-gnome-wrapper --provider codex --format text
/home/bcjamal/.local/bin/codexbar-gnome-wrapper --provider claude --format text
```

## Parsing Rules to Reuse

Parse session and weekly remaining:

```regex
^Session:\s+(\d+(?:\.\d+)?)%\s+left
^Weekly:\s+(\d+(?:\.\d+)?)%\s+left
```

Convert remaining to used:

```text
usedPercent = 100 - remainingPercent
```

Parse pace:

```regex
Pace:\s+(.+)
(\d+(?:\.\d+)?)%\s+in deficit
(\d+(?:\.\d+)?)%\s+in reserve
Expected\s+(\d+(?:\.\d+)?)%\s+used
Runs out in\s+(.+)
Lasts until reset
```

Suggested dashboard model:

```json
{
  "provider": "claude",
  "session": {
    "remainingPercent": 33,
    "usedPercent": 67,
    "resetsIn": "2h 34m"
  },
  "weekly": {
    "remainingPercent": 8,
    "usedPercent": 92,
    "resetsIn": "1d 10h"
  },
  "pace": {
    "status": "deficit",
    "amountPercent": 12,
    "expectedUsedPercent": 80,
    "runsOutIn": "11h 38m",
    "lastsUntilReset": false,
    "raw": "12% in deficit | Expected 80% used | Runs out in 11h 38m"
  }
}
```

For Codex reserve:

```json
{
  "pace": {
    "status": "reserve",
    "amountPercent": 6,
    "expectedUsedPercent": 42,
    "runsOutIn": null,
    "lastsUntilReset": true
  }
}
```

## Failure Modes Found

Claude JSON may hang or timeout in some GNOME subprocess contexts, even when text eventually works. For a dashboard, do not let one provider block the whole refresh. Use per-command timeouts and show stale/partial data.

Recommended timeouts:

```text
JSON command: 4-8 seconds
Text pace command: 30 seconds for Claude, 8-15 seconds for Codex
```

GNOME Shell can cache extension JavaScript modules. Editing `extension.js` and running `gnome-extensions disable/enable` may not load new code on Wayland. A full GNOME logout/login may be required.

Codex text output can include `Pace:` after multiple other fields. Do not rely on `Pace:` being at the start of a line if output is captured or transformed by a UI process. Search the entire output blob for `Pace:`.

## Where to Look for Current Implementation

GNOME parser and UI:

```bash
/home/bcjamal/.local/share/gnome-shell/extensions/codexbar@inled.es/extension.js
```

Look for these functions/sections:

```text
_refreshData()
_runCommandWithTimeout()
_parseTextUsage()
_parsePaceLine()
_getPanelPredictionText()
_createForecastCard()
```

GNOME styling:

```bash
/home/bcjamal/.local/share/gnome-shell/extensions/codexbar@inled.es/stylesheet.css
```

Look for:

```text
.codexbar-panel-prediction
.codexbar-forecast-card
.codexbar-forecast-card-muted
.codexbar-forecast-title
.codexbar-forecast-detail
```

Wrapper:

```bash
/home/bcjamal/.local/bin/codexbar-gnome-wrapper
```

## Dashboard Design Ideas

For a nicer personal dashboard, do not copy the GNOME extension UI directly. Use the data model, but build a clearer interface:

- Show one card per provider: Claude, Codex.
- Put the most urgent forecast at the top: `Runs out in 11h 38m`, `6% reserve`, or `Lasts until reset`.
- Use two bars per provider: current session and weekly.
- Use semantic colors: green/reserve, amber/near limit, red/deficit or predicted runout.
- Show reset times beside each bar.
- Show stale/error state per provider instead of failing the whole dashboard.
- Keep raw CLI output hidden by default, but available in a details/debug drawer.

Suggested card layout:

```text
Claude
Runs out in 11h 38m

Session   67% used   resets in 2h 34m
[=============-------]

Weekly    92% used   resets in 1d 10h
[==================--]

Pace: 12% in deficit | Expected 80% used
```

Suggested refresh model:

```text
Every 5 minutes:
  run JSON and text commands in parallel per provider
  apply per-command timeout
  cache last successful result
  update UI with "updated X min ago"
```

## Implementation Recommendation

For a web dashboard, create a small local backend service instead of calling the CLI directly from frontend code.

Backend responsibilities:

```text
GET /api/usage
  runs/caches CodexBar CLI data
  merges JSON + Pace text
  returns clean normalized JSON
```

Frontend responsibilities:

```text
render provider cards
render progress bars
render forecast status
render stale/error states
```

This keeps CLI quirks, timeouts, and parsing out of the UI.

## Minimal Backend Pseudocode

```js
const providers = ["claude", "codex"];

for (const provider of providers) {
  const json = await runWithTimeout(
    `/home/bcjamal/.local/bin/codexbar usage --provider ${provider} --source cli --format json`,
    8000
  );

  const text = await runWithTimeout(
    `/home/bcjamal/.local/bin/codexbar-gnome-wrapper --provider ${provider} --format text`,
    provider === "claude" ? 30000 : 15000
  );

  return mergeUsageAndPace(json, text);
}
```

## Quick Sanity Checks

Run these before debugging dashboard code:

```bash
/home/bcjamal/.local/bin/codexbar-gnome-wrapper --provider claude --format text
/home/bcjamal/.local/bin/codexbar-gnome-wrapper --provider codex --format text
```

Expected output includes:

```text
Session: ...
Weekly: ...
Pace: ...
```

If the wrapper returns `Pace:` but the dashboard does not show it, the bug is in dashboard parsing/rendering, not CodexBar.
