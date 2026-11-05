---
name: verify-skill-shelf
description: Verify Skill Shelf's real terminal UI and CLI after changes to discovery, grouping, scope switching, details, keyboard navigation, or terminal lifecycle. Use for end-to-end verification or requests to prove user-visible behavior; capture PTY actions, output, exit codes, and read-only filesystem evidence.
compatibility: macOS or Unix, Node.js 20+, Python 3.9+, and installed npm dependencies.
---

# Verify Skill Shelf

Drive the built CLI, not exported data/layout functions. The primary surface is an
Ink terminal UI; `--help`, `--version`, and noninteractive errors are secondary CLI
surfaces. There is no server, port, database, login, or browser.

## Launch

Run from the repository root. If dependencies are absent, run `npm ci`. Then:

```sh
npm run build
python3 .agents/skills/verify-skill-shelf/scripts/verify.py doctor
python3 .agents/skills/verify-skill-shelf/scripts/verify.py all
```

The helper resolves this checkout's absolute `dist/cli.js`, creates a disposable
home and nested project, and starts a fresh process in a controlling Unix PTY for
each UI journey. Fixtures are verification scaffolding, not mocks: they are real
`SKILL.md` files and schema-v1/v3 locks consumed by normal startup discovery.
Readiness requires raw input mode plus the Project header, `parent-only`, and
`Enter details` in terminal output. A running process alone is insufficient.

Each run has its own home, CWD, and minimal environment. Host path overrides are
not inherited; config/state paths are inside the fake home. Ancestor discovery
stops at that home, keeping the user's skills out of the run. Independent runs
can coexist; do not rebuild `dist` concurrently with verification.

## Doctor

`verify.py doctor` is read-only: check Node's major version, the absolute local CLI,
source/package freshness against the build, package/CLI version agreement, and a
SHA-256 of the entry point. It exits nonzero if rebuilding is needed. Each drive
runs it first. When results look wrong, rerun doctor before investigating the UI.
No shared long-lived instance needs attaching to or killing.

## Drive

Read [the feature map](features/README.md), select every feature affected by the
change, and run its named journey. For example:

```sh
python3 .agents/skills/verify-skill-shelf/scripts/verify.py details
```

The helper follows the existing `test/terminal.py` PTY recipe: `pty.fork`, real
stdin bytes, `TIOCSWINSZ`/`SIGWINCH`, and observed terminal strings. It adds bounded
quit waits, per-action evidence, fixture fingerprints, and teardown. Key bytes are
Enter `\r`, Tab `\t`, Esc `\x1b`, arrows `\x1b[A/B/C/D`, Ctrl+C `\x03`, and literal
`h/j/k/l/q`. Waits use output from the current action, not an earlier transcript.

Supported journeys: `project`, `global`, `details`, `terminal`, `cli`, or `all`.
Inspect `report.json` and the action/result pairs; command success alone is not a
complete feature proof. The seeded journeys are smoke coverage, not exhaustive
verification of every mapped sub-feature. Add a real filesystem precondition and
a PTY journey for an uncovered behavior; report unmet preconditions as failures
or not checked rather than substituting an easier route.

## Evidence

By default the helper prints a unique `skill-shelf-proof-*` directory under the
system's configured temporary directory. For durable retention, pass a new empty
absolute directory outside the checkout, e.g.:

```sh
python3 .agents/skills/verify-skill-shelf/scripts/verify.py all \
  --evidence "$HOME/Documents/skill-shelf-proof-$(date +%Y%m%d-%H%M%S)"
```

- `report.json`: build identity, fixture paths, passed journeys, failure reason,
  read-only check, and cleanup result.
- `<feature>.actions.json`: ordered keystrokes, resize actions, and expectations.
- `<feature>.events.json`: each action paired with newly observed terminal output.
- `<feature>.ansi`: raw terminal transcript, including alternate-screen/cursor codes.
- `cli.json`: CLI arguments, stdout, stderr, and exit codes.
- `before.json` / `after.json`: directory inventory and file-content hashes.

Prove the action and result together. Selection needs an underline marker or the
selected skill's detail view, not just a name somewhere in the overview. Prove
read-only browsing with equal inventories; assert successful exit and cursor/
alternate-screen restoration. Raw transcripts are output streams, not screenshots
or a reconstructed terminal screen: visually inspect a real terminal when judging
spacing, color, clipping, or scroll correctness. No app functions, state setters,
test-only endpoints, network calls, or mocked production boundaries are used.
Hash equality proves content/inventory, not absence of reads, transient writes,
metadata-only changes, or network activity; do not claim those were audited.

## Cleanup

The helper quits via `q` or Ctrl+C, waits up to eight seconds for exit, and on
failure kills and reaps only its own child PID. Its `finally` blocks close the PTY,
record partial transcripts, compare files, and remove only its unique scratch
directory. Exceptions still produce a failed report. No process-name kills.

Evidence lives separately and survives cleanup. Confirm `scratch_removed: true`,
`fixture_unchanged: true`, and that the named evidence files still exist after
the helper exits. A forced termination of the helper itself can bypass cleanup;
use recorded scratch/PID information to inspect ownership before manual cleanup.

## Helpers and reporting

The executable helper is `scripts/verify.py`; invoke it with Python as shown above.
It uses only Python's standard library and the project's installed runtime.
Report passed/failed/not-checked features, evidence location, side-effect check,
and cleanup status. Unit tests remain useful for exhaustive data/layout cases;
this skill adds reproducible user-path verification and diagnostic evidence.

Maintain the map and journeys whenever controls or discovery behavior change.
The upstream workflow calls this `/maintain-verification-skill`; use that command
only if available in your agent, otherwise edit this map and rerun the journeys.
