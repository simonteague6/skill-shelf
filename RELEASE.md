# npm releases

Skill Shelf is an npm CLI package, not a skills.sh skill. Releases are manual and require explicit approval; no workflow publishes automatically.

## Prepare

1. Review the intended semantic version, license, package metadata, and README. npm versions cannot be reused after publication.
2. Confirm the npm package name and publishing account. For the first release, check the name on the public registry; a 404 does not reserve it.
3. From a clean, reviewed commit, run `npm ci` and `npm run release:check`. The tests install the packed CLI into a temporary directory and require access to npm for its dependencies. Inspect the package contents printed by the dry run.
4. Confirm the intended npm registry and authenticate as the authorized package owner. Do not commit credentials. Direct publication requires npm 2FA or an appropriate granular access token; prefer interactive 2FA.

## Publish

After approval, publish the reviewed commit with `npm publish --access public`. Verify the published version and install the CLI in a clean environment. For subsequent releases, update the version using semantic versioning, review and commit the change, repeat the checks, and publish only after approval.

For future automation, npm supports [trusted publishing](https://docs.npmjs.com/trusted-publishers/) from GitHub-hosted Actions with Node 22.14+ and npm 11.5.1+. A package owner can configure a specific workflow on npm after the package exists. The workflow needs `id-token: write`; consider stage-only publishing and 2FA approval. Newly created trusted publisher configurations expire if their first successful publication does not occur within two days. No trusted publisher is configured by this project.
