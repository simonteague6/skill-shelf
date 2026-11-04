# Skill Shelf

A read-only terminal browser for project and global agent skills. Skill Shelf lists skill folder names and groups them by the source recorded in their lock file. It does not edit skills or lock files.

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
- Arrow keys or `j` and `k` scroll the current view.
- `q` or `Ctrl+C` quits.

Skill Shelf reads both views at startup. Restart it to see filesystem changes. It requires a terminal for both input and output; redirected input or output returns an error. `--help` and `--version` also work without a terminal.

## What it reads

Project skills come from `.agents/skills` and `skills-lock.json` in the discovered project directory. Global skills come from `~/.agents/skills` and `~/.agents/.skill-lock.json` independently.

Starting at the working directory, Skill Shelf searches upward for the nearest project skills directory or lock file. A Git root stops the search, even when it has no skills. The home directory is a boundary, not a project, so global skills are not mistaken for project skills. If no marker is found, the working directory is used unless it is the home directory. The `skills` installer itself uses the working directory for project installs rather than this upward search. In a monorepo, run Skill Shelf inside the intended project when nested installations exist.

Each directory or directory symlink directly inside the skills folder counts as an installed skill. Broken symlinks, files, and lock-only entries do not count. The lock provides source metadata, not the inventory. Two or more installed skills with the same recorded source appear together. A source with one installed skill appears under Other sources with its source name. Skills without usable source metadata appear under Your collection. A missing or invalid lock does not hide installed folders; the view reports the missing or unreadable lock when applicable.

Only the paths above are scanned. Agent-specific skill directories, alternate global locations, nested skill folders, and skill descriptions are not read. Directory names are shown without validating `SKILL.md`. A project view shows `No project skills` when its skills directory is absent or empty.

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

`npm run format` applies formatting. Tests build the TypeScript sources and run the Node.js test suite. The CLI declares support for Node 20 and later; CI checks Node 24 only, so other versions are not covered by CI. The interface uses a compact column list with pastel source headings and separate rows for individual sources.

## Release preparation

The npm CLI package and the skills.sh skill registry are separate: this project is a CLI, not a skill for installation through skills.sh.

Before a release, choose a semantic version, verify the checks above, inspect `npm pack --dry-run`, and review the package metadata and license. A release requires explicit approval; CI does not publish or create tags. An npm account and package ownership are required for publishing. For future automated releases, consider a GitHub-hosted workflow using npm trusted publishing with Node 22.14 or later, npm 11.5.1 or later, and `id-token: write`. Configure its exact repository and workflow filename on npm only when ready to release, and protect the release trigger. See [npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).
