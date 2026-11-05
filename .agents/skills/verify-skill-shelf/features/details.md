# Skill details

## Sub-features

- Enter opens Source and Installed locations for the selection.
- Left/right arrows or `h/l` browse skills while remaining in details.
- Esc and Enter return to overview; up/down or `j/k` scroll long details.
- Alias labels, identical-copy labels, and home-relative installed paths.

## How to get to it (user POV)

Select a Project or Global skill and press Enter. Navigate between skills or
scroll, then press Esc or Enter to return.

## Driving it with verify.py

Run journey `details`. Enter on alpha must reveal `Source`, `repo/a`,
`Installed locations`, `Agents`, and `.agents/skills/alpha`. Right/left arrows
must show beta/alpha with the detail heading still present. Enter returns to
the overview footer; Enter reopens details; Esc returns again. The `project`
journey covers `h/l`, `global` covers opening a global skill, and `terminal`
covers scroll input at a short height. Run these too when changing shared controls.

## Gotchas

The app displays provenance and paths, not the SKILL.md body. Single-location
fixtures do not prove alias/copy labels or deep scrolling. The short-terminal
journey checks responsiveness, not a reconstructed viewport's exact scroll
position; add enough real locations and specific reveal/hide assertions for a
scroll fix. Terminal output may wrap paths, so avoid matching an arbitrarily long
absolute path as a single contiguous string.
