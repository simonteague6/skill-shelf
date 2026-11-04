# Skill Shelf

A read-only terminal browser for project and global agent skills. Skill Shelf lists skill folder names and groups them by the source recorded in their lock file. It does not edit skills or lock files.

## Run

Requires Node.js 20 or later and an interactive terminal.

```sh
npm install
npm run build
node dist/cli.js
```

Run the command from the project you want to inspect. To build a local npm package, run `npm pack`. The package includes the `skill-shelf` executable; it has not been published by this project.

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
npm test
```

The test command builds the TypeScript sources and runs the Node.js test suite. `npm run build` builds without running tests.
