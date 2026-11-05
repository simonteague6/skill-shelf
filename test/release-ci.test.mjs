import { test } from 'node:test';
import assert from 'node:assert/strict';
import dispatchReleaseCI from '../scripts/dispatch-release-ci.cjs';

function fixture() {
  const context = { repo: { owner: 'owner', repo: 'repo' }, sha: 'trusted-main-sha' };
  const pr = {
    state: 'open',
    base: { ref: 'main', repo: { full_name: 'owner/repo' } },
    head: {
      ref: 'release-please--branches--main',
      sha: 'release-head-sha',
      repo: { full_name: 'owner/repo' },
    },
    user: { login: 'github-actions[bot]' },
    labels: [{ name: 'autorelease: pending' }],
  };
  const dispatches = [];
  const lookups = [];
  const github = {
    rest: {
      pulls: { get: async () => ({ data: pr }) },
      repos: {
        getContent: async (input) => {
          lookups.push(input);
          return { data: { sha: 'identical-workflow-blob' } };
        },
      },
      actions: { createWorkflowDispatch: async (input) => dispatches.push(input) },
    },
  };
  return { context, github, pr, dispatches, lookups, releasePR: '{"number":42}' };
}

test('generated release PR gets CI on its own branch after workflow comparison with trusted main', async () => {
  const setup = fixture();
  await dispatchReleaseCI(setup);
  assert.deepEqual(setup.dispatches, [
    { owner: 'owner', repo: 'repo', workflow_id: 'ci.yml', ref: 'release-please--branches--main' },
  ]);
  assert.deepEqual(
    setup.lookups.map(({ path, ref }) => ({ path, ref })),
    [
      { path: '.github/workflows/ci.yml', ref: 'release-head-sha' },
      { path: '.github/workflows/ci.yml', ref: 'trusted-main-sha' },
    ],
  );
});

test('unexpected release PRs and changed CI workflows never dispatch', async () => {
  for (const change of [
    (setup) => {
      setup.releasePR = '{"number":"42"}';
    },
    ({ pr }) => {
      pr.state = 'closed';
    },
    ({ pr }) => {
      pr.base.ref = 'other';
    },
    ({ pr }) => {
      pr.head.repo.full_name = 'fork/repo';
    },
    ({ pr }) => {
      pr.base.repo.full_name = 'other/repo';
    },
    ({ pr }) => {
      pr.head.ref = 'arbitrary-branch';
    },
    ({ pr }) => {
      pr.user.login = 'someone';
    },
    ({ pr }) => {
      pr.labels = [];
    },
    ({ github }) => {
      github.rest.repos.getContent = async ({ ref }) => ({ data: { sha: ref } });
    },
    ({ github }) => {
      github.rest.pulls.get = async () => {
        throw new Error('API unavailable');
      };
    },
  ]) {
    const setup = fixture();
    change(setup);
    await assert.rejects(() => dispatchReleaseCI(setup));
    assert.deepEqual(setup.dispatches, []);
  }
});
