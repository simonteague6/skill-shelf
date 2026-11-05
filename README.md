# Skill Shelf

A read-only terminal browser for locally installed agent skills across skills.sh-supported destinations. Browse project ancestors and a separate global collection, grouped by recorded source. Skill Shelf does not edit skills or lock files, fetch registries, or detect which agents are installed.

## Run the npm package

Requires Node.js 20 or later and an interactive terminal.

```sh
npx @simonteague6/skill-shelf
```

Or install the CLI globally and run it:

```sh
npm install --global @simonteague6/skill-shelf
skill-shelf
```

Run the command from the project you want to inspect. In the Skill Shelf source checkout, npm can resolve the local package without providing its executable to `npx`. Build and run the source directly instead:

```sh
npm ci
npm run build
node dist/cli.js
```

To build a local npm package, run `npm pack`.

## Controls

- `Tab` switches between Project and Global. Project opens first.
- Arrow keys or `h`/`j`/`k`/`l` select skills in the displayed grid.
- `Enter` opens Source and Installed locations. `Esc` or `Enter` returns to the overview.
- In details, up/down or `j`/`k` scroll; left/right or `h`/`l` browse skills.
- `q` or `Ctrl+C` quits.

Skill Shelf reads both views at startup. Restart it to see filesystem changes. It requires a terminal for both input and output; redirected input or output returns an error. `--help` and `--version` also work without a terminal.

## What it reads

Project includes recognized installation locations at the working directory and every ancestor, nearest first, including above Git roots. Discovery stops before home; launching at home gives an empty Project view. Outside home, discovery includes ancestors through the filesystem root. Siblings and descendants are not searched. Each populated directory has its own section; Global stays separate.

The checked-in [destination registry](https://github.com/simonteague6/skill-shelf/blob/main/src/registry.ts) follows `vercel-labs/skills` revision `1a1d387ed4286e59aa43a2696cf02b3590061c91` (2026-11-04). It includes shared `.agents/skills`, agent-specific paths such as `.claude/skills` and `.hermes/skills`, nonhidden project paths such as `agent/skills`, and global paths such as `~/.config/opencode/skills`. Missing optional locations are silent. No generic hidden-directory search or custom-path configuration is used.

Only immediate skill directories and directory symlinks with readable `SKILL.md` count; frontmatter is not validated. Broken links, unrelated folders, files and lock-only entries do not count. Aliases to the same resolved folder and proven identical complete copies collapse within one directory level or within Global. Supporting files, binary assets and relative file sets participate in equality. Different content stays separate even under the same name; nothing collapses across project levels or scopes. Details retain observed paths, with **Agents** for `.agents` destinations and **linked folder** or **identical copy** where applicable.

Project metadata comes only from `skills-lock.json` (schema v1) at each included level. Global metadata comes from `~/.agents/.skill-lock.json` (schema v3), or `$XDG_STATE_HOME/skills/.skill-lock.json`. Locks supply recorded attribution, not inventory or proof of pristine content. Missing metadata leaves skills visible; conflicting alias records and ambiguous same-name variants go to Your collection. Repository groups and skills are alphabetical, followed by Your collection; singleton sources retain the Other sources section. Read/metadata/comparison issues produce concise nonfatal notices.

Global destinations honor upstream path overrides: `XDG_CONFIG_HOME`, `CLAUDE_CONFIG_DIR`, `HERMES_HOME`, `VIBE_HOME`, `AUTOHAND_HOME`, `GROK_HOME` and `REASONIX_HOME`. XDG config must be absolute; the upstream global lock reader uses `XDG_STATE_HOME` verbatim. OpenClaw uses the first existing `.openclaw`, `.clawdbot` or `.moltbot` home directory. See [compatibility and safety limits](https://github.com/simonteague6/skill-shelf/blob/main/docs/compatibility.md) for the exact comparison budgets and platform details.

This is an observational startup snapshot, not an agent activation or precedence model. A shared destination does not prove that an agent is installed or that every agent activates ancestor skills.

## Development

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

`npm run format` applies formatting. Tests build the TypeScript sources and run the Node.js test suite; Unix interactive CLI tests also require Python 3 for the PTY driver. The CLI declares support for Node 20 and later; CI checks Node 24 only, so other versions are not covered by CI. The interface uses selectable grids with pastel source headings, directory sections and a detail view.

## Release preparation

The npm CLI package and the skills.sh skill registry are separate: this project is a CLI, not a skill for installation through skills.sh.

Before a release, choose a semantic version, verify the checks above, inspect `npm pack --dry-run`, and review the package metadata and license. A release requires explicit approval; CI does not publish or create tags. An npm account and package ownership are required for publishing. For future automated releases, consider a GitHub-hosted workflow using npm trusted publishing with Node 22.14 or later, npm 11.5.1 or later, and `id-token: write`. Configure its exact repository and workflow filename on npm only when ready to release, and protect the release trigger. See [npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).
