module.exports = async function dispatchReleaseCI({ github, context, releasePR }) {
  const { number } = JSON.parse(releasePR);
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
  await github.rest.actions.createWorkflowDispatch({
    ...context.repo,
    workflow_id: 'ci.yml',
    ref: pr.head.ref,
  });
};
