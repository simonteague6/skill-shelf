# Skill Shelf feature map

Use this as the maintained user-facing verification index. Commands below run
from the repository root after the skill's Launch and Doctor steps.

| Feature                           | Journey    | Proof                                                           |
| --------------------------------- | ---------- | --------------------------------------------------------------- |
| [Project browsing](project.md)    | `project`  | Ancestor inventory, source groups, selected skill changes       |
| [Global collection](global.md)    | `global`   | Tab changes scope; global-only skill opens; return to Project   |
| [Skill details](details.md)       | `details`  | Source and installed path, next/previous, both return controls  |
| [Terminal lifecycle](terminal.md) | `terminal` | Small/large resize, scroll input, Ctrl+C, restored terminal     |
| [CLI contract](cli.md)            | `cli`      | Help/version, redirected-input rejection, invalid-argument exit |

Invoke `python3 .agents/skills/verify-skill-shelf/scripts/verify.py <journey>` or
`all`. See each page's Gotchas for coverage limits. A smoke pass is not proof of
an unexercised sub-feature or alternate entry point.
