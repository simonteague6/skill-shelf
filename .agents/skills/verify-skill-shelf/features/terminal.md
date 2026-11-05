# Terminal lifecycle

## Sub-features

- Raw input and alternate-screen entry.
- Responsive layout on terminal resize; detail scroll controls.
- `q` and Ctrl+C exit successfully and restore cursor/alternate screen.

## How to get to it (user POV)

Run in an interactive terminal. Resize the window in overview or details. Use
`j/k` or arrows to scroll details. Press `q` or Ctrl+C to quit.

## Driving it with verify.py

Run journey `terminal`. Open details, resize from 80×24 to 30×12 with
`TIOCSWINSZ` and `SIGWINCH`, and expect `Esc back · ↑↓ · q quit`. Send `j`, then
`k`, checking responsive output and `Source`. Esc returns to the compact overview
footer. Resize to 120×38; expect `Enter details`. Send Ctrl+C; require exit 0,
cursor-show `ESC[?25h` and alternate-screen-leave `ESC[?1049l`. Other UI journeys
prove `q` through the same lifecycle checks.

## Gotchas

Unix PTYs only; this does not verify Windows behavior or every terminal emulator.
ANSI transcripts are not screen images. For visual regressions additionally run
`node /absolute/path/to/dist/cli.js` in an owned interactive terminal using the
same disposable fixture strategy, capture the viewport, and preserve evidence.
Do not attach to or send keys to the user's existing session.
