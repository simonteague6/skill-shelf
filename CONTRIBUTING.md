# Contributing

Skill Shelf is a read-only terminal browser for locally installed agent skills. Changes should preserve that boundary: browsing does not modify skills or lock files, fetch registries, or detect installed agents. See the [README](README.md) for behavior, [glossary](GLOSSARY.md) for terminology, and [compatibility and safety](docs/compatibility.md) for discovery rules and limits.

## Set up and run

Use Node.js 24 to match CI (the package declares Node.js 20 or later). On Unix, interactive CLI tests also need Python 3.9 or later, available as `python3`.

```sh
npm ci
npm run build
node dist/cli.js
```

Run the CLI in an interactive terminal. Its working directory determines the Project scope; use an absolute path to `dist/cli.js` when launching from another directory.

In the source checkout, `npx` can resolve the local package without providing its executable. Use the build and direct invocation above when working on this repository. Both input and output must be terminals; redirected input or output returns an error.

## Make and check changes

Edit TypeScript sources in `src/`; `dist/` is build output. Discovery and grouping live in `src/data.ts`, destinations in `src/registry.ts`, rendering in `src/app.tsx` and `src/layout.ts`, and the CLI entry point in `src/cli.tsx`. Preserve the upstream attribution and license notice when editing the destination registry.

Add or update tests in `test/` for behavior changes. The suite uses Node's test runner, temporary filesystem fixtures, and `test/terminal.py` for interactive terminal coverage. Tests import the built JavaScript; `npm test` builds it first. To run one test file:

```sh
npm run build
node --test test/inventory.test.mjs
```

Before opening a pull request, run the same checks as CI:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

`npm run format` applies Prettier formatting across the repository. CI runs on Ubuntu with Node.js 24; it does not cover every supported Node version or platform.

Run `npm pack` to build a local npm package. Skill Shelf is an npm CLI, not a skill to install through skills.sh.

## Submit a pull request

Use Conventional Branch names such as `fix/terminal-navigation` or `feat/source-details`, and Conventional Commits and PR titles such as `fix: restore terminal after exit` or `docs: clarify project discovery`.

Describe the change, why it is needed, and the checks you ran. Include reproduction steps for bug fixes and terminal output or a recording for visible UI changes. Update relevant documentation to describe the current behavior.

Release Please manages version bumps and `CHANGELOG.md` from Conventional Commits on `main`, using Semantic Versioning with the project's pre-1.0 rules. See [releasing](docs/releasing.md) for versioning and release procedures.
