import { test } from 'node:test';
import assert from 'node:assert/strict';
import dispatchReleaseCI from '../scripts/dispatch-release-ci.cjs';

function fixture() {
  const context = {
    repo: { owner: 'owner', repo: 'repo' },
    sha: 'trusted-main-sha',
    ref: 'refs/heads/main',
  };
  const pr = {
    state: 'open',
    base: { ref: 'main', repo: { full_name: 'owner/repo' } },
    head: {
      ref: 'release-please--branches--main',
      sha: 'a'.repeat(40),
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

test('generated release PR dispatches trusted main CI with an immutable intended head', async () => {
  const setup = fixture();
  await dispatchReleaseCI(setup);
  assert.deepEqual(setup.dispatches, [
    {
      owner: 'owner',
      repo: 'repo',
      workflow_id: 'ci.yml',
      ref: 'main',
      inputs: { release_pr: '42', head_sha: 'a'.repeat(40) },
    },
  ]);
  assert.deepEqual(
    setup.lookups.map(({ path, ref }) => ({ path, ref })),
    [
      { path: '.github/workflows/ci.yml', ref: 'a'.repeat(40) },
      { path: '.github/workflows/ci.yml', ref: 'trusted-main-sha' },
    ],
  );
});

test('a dispatch whose intended head has changed fails and schedules the current validated head', async () => {
  const setup = fixture();
  const validate = dispatchReleaseCI.validate;
  await dispatchReleaseCI(setup);
  const intendedSha = setup.dispatches[0].inputs.head_sha;
  setup.pr.head.sha = 'b'.repeat(40);
  await assert.rejects(
    () => validate({ ...setup, number: '42', expectedSha: intendedSha }),
    /head changed/,
  );
  assert.equal(setup.dispatches.length, 2);
  assert.equal(setup.dispatches[1].ref, 'main');
  assert.equal(setup.dispatches[1].inputs.head_sha, 'b'.repeat(40));
});

test('release CI validates the exact head before testing and rejects invalid dispatch inputs', async () => {
  const setup = fixture();
  assert.equal(
    await dispatchReleaseCI.validate({ ...setup, number: '42', expectedSha: 'a'.repeat(40) }),
    'a'.repeat(40),
  );
  assert.deepEqual(setup.dispatches, []);
  for (const override of [
    { expectedSha: 'main' },
    { number: 'invalid' },
    { context: { ...setup.context, ref: 'refs/heads/other' } },
  ]) {
    await assert.rejects(() =>
      dispatchReleaseCI.validate({
        ...setup,
        number: '42',
        expectedSha: 'a'.repeat(40),
        ...override,
      }),
    );
  }
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
