# CLI contract

## Sub-features

- `--help` and `--version` work without a terminal.
- Normal launch rejects redirected input/output with exit 1.
- Unknown arguments print usage and exit 2.

## How to get to it (user POV)

Run `skill-shelf --help` or `skill-shelf --version`. Running `skill-shelf` in a
pipeline is unsupported; run it in an interactive terminal to browse instead.

## Driving it with verify.py

Run journey `cli`. The helper spawns the actual built entry point with captured
stdin/stdout/stderr. Expect usage and exit 0 for `--help`, the package version
and exit 0 for `--version`, an interactive-terminal error and exit 1 with no
arguments, and usage/exit 2 for `--invalid`. No case may enter the alternate
screen. `cli.json` retains arguments, output, and exit codes for each action.

## Gotchas

Do not use `npx` here: inside this source checkout it can resolve the local
package without exposing its binary, and outside it might fetch another build.
This journey verifies the built source entry point, not a packed/global npm
installation. Mixed flags and independently redirected stdin versus stdout are
not covered by this smoke journey.
