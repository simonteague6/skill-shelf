# npm releases

[Release Please](https://github.com/googleapis/release-please-action) maintains a release PR from Conventional Commits on `main`, updating package/lock versions, the manifest, and `CHANGELOG.md`. Review and merge that PR to create the GitHub release and publish npm through OIDC in the same workflow. Release PRs are not auto-merged.

## Release policy

- `fix:` bumps patch; `feat:` bumps minor. Breaking changes bump minor below 1.0, major thereafter. For an intentional 1.0, use a reviewed [Release-As override](https://github.com/googleapis/release-please#how-do-i-change-the-version-number).
- Only stable `vMAJOR.MINOR.PATCH` releases publish, to `latest`. The initial manifest is `0.1.0`; `bootstrap-sha` excludes the existing distribution history from the first changelog.
- `CHANGELOG.md` is generated and excluded from Prettier; review it in the release PR.

## One-time setup

1. In repository **Settings → Actions → General → Workflow permissions**, enable **Allow GitHub Actions to create and approve pull requests**. Keep the default token read-only; the workflow requests job-specific permissions.
2. Merge this workflow before relying on releases. Near the first actual release, configure an npm **GitHub Actions** trusted publisher for `@simonteague6/skill-shelf`: user `simonteague6`, repository `skill-shelf`, workflow filename `release.yml`, environment blank. Explicitly allow **npm publish**, not just staging. No npm token, PAT, or repository secret is required.
3. Complete the first publication within **two days** of creating trust, or recreate expired trust when ready. See [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/).

## Release and recovery

1. Review the generated PR and wait for ordinary CI on its current head. With `GITHUB_TOKEN`, bot PR workflows may require **Approve workflows to run**; if GitHub suppresses the event, close and reopen the PR as a maintainer to trigger CI. Repeat after bot updates if needed. This manual gate is intentional; do not bypass required checks.
2. Merge the release PR. The publish job checks the released SHA/tag/package/lock agreement, runs `npm ci` and full `release:check`, then rejects versions older than registry `latest`. Missing/invalid registry metadata or network errors stop publication. Node 24 supplies OIDC-capable npm; npm generates provenance for trusted publishing from this public repository.
3. Verify the Actions result, npm version, and provenance. If publishing fails, fix the cause and use **Re-run failed jobs** to retry publishing with the successful Release Please job outputs. Do not rerun all jobs expecting `release_created` again. An already-published version fails normally: inspect npm before retrying; never overwrite versions or recreate tags. Publish corrected contents as a new release.

Do not publish externally/concurrently: the `latest` check and npm publication are not atomic. Bookkeeping-only pushes run API-only Release Please; full checks run in ordinary CI and before actual publishing. The first hosted release still needs verification of bot-PR CI, release creation, failed-job retry, npm OIDC, and provenance after setup.
