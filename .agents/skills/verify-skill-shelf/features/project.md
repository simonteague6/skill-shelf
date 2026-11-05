# Project browsing

## Sub-features

- Inventory at CWD and ancestors, nearest first, stopping before home.
- Source grouping from each directory's lock; unrecorded skills stay visible.
- Horizontal/vertical grid navigation with arrows and `h/j/k/l`.
- Missing destinations, aliases/copies, malformed metadata, and empty states.

## How to get to it (user POV)

Launch `skill-shelf` from the project to inspect. Project opens first. Navigate
with arrows or `h/j/k/l`; Enter inspects the selected skill.

## Driving it with verify.py

Run journey `project`. The fixture has four local skills grouped into `repo/a`
and `repo/b`, one ancestor `parent-only`, and one home-level global skill. Expect
`Project · 5 installed` (with terminal spacing), `parent-only`, and the overview
footer. Open alpha and check `repo/a`; `l`/`h` moves between beta/alpha details.
Return with Esc; `j`/`k` select charlie/alpha, right/left arrows select beta/alpha.
Underlined names and the subsequent detail view prove selection, not merely
presence in the list. Quit with `q` and compare fixture fingerprints.

## Gotchas

Home's `global-only` must not inflate the Project count. The current seed does
not exercise aliases, identical copies, conflicting metadata, empty Project,
sibling/descendant exclusion, above-Git-root discovery, or up/down arrow bytes.
Add those filesystem conditions and action paths when relevant; data unit tests
alone do not establish their rendered UI behavior.
