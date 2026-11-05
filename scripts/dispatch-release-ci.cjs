async function validatedPR({ github, context, number }) {
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error('Invalid release PR number');
  const { data: pr } = await github.rest.pulls.get({ ...context.repo, pull_number: number });
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  if (
    pr.state !== 'open' ||
    pr.base.ref !== 'main' ||
    pr.head.repo?.full_name !== repository ||
    pr.base.repo.full_name !== repository ||
    pr.head.ref !== 'release-please--branches--main' ||
    pr.user.login !== 'github-actions[bot]' ||
    !pr.labels.some((label) => label.name === 'autorelease: pending')
  ) {
    throw new Error('Refusing to dispatch CI for an unexpected release PR');
  }
  const workflow = async (ref) =>
    (
      await github.rest.repos.getContent({
        ...context.repo,
        path: '.github/workflows/ci.yml',
        ref,
      })
    ).data.sha;
  if ((await workflow(pr.head.sha)) !== (await workflow(context.sha))) {
    throw new Error('Release PR CI workflow differs from trusted main');
  }
  return pr;
}

async function dispatchReleaseCI({ github, context, releasePR }) {
  const { number } = JSON.parse(releasePR);
  const pr = await validatedPR({ github, context, number });
  await github.rest.actions.createWorkflowDispatch({
    ...context.repo,
    workflow_id: 'ci.yml',
    ref: 'main',
    inputs: { release_pr: String(number), head_sha: pr.head.sha },
  });
}

module.exports = dispatchReleaseCI;
module.exports.validate = async function validateReleaseCI({
  github,
  context,
  number,
  expectedSha,
}) {
  if (context.ref !== 'refs/heads/main') throw new Error('Release CI must run from main');
  if (!/^[a-f0-9]{40}$/.test(expectedSha)) throw new Error('Invalid release head SHA');
  const pr = await validatedPR({ github, context, number: Number(number) });
  if (pr.head.sha !== expectedSha) {
    await dispatchReleaseCI({
      github,
      context,
      releasePR: JSON.stringify({ number: Number(number) }),
    });
    throw new Error('Release PR head changed; scheduled CI for the current validated head');
  }
  return pr.head.sha;
};
