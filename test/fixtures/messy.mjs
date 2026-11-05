import { mkdir, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';

export async function messyFixture(home) {
  const current = join(home, 'work/atlas/app');
  const parent = join(home, 'work/atlas');
  const ancestor = join(home, 'work');
  async function install(base, destination, name, content = name) {
    const folder = join(base, destination, name);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'SKILL.md'), `# ${content}\n`);
    await writeFile(join(folder, 'asset.bin'), Buffer.from([0, 255, 1]));
    return folder;
  }
  async function alias(base, destination, name, target) {
    await mkdir(join(base, destination), { recursive: true });
    await symlink(target, join(base, destination, name));
  }
  const shared = [
    'code-review',
    'tdd',
    'research',
    'domain-modeling',
    'writing',
    'accessibility',
    'debugging',
    'git',
    'security',
    'planning',
  ];
  const projectLock = Object.fromEntries(
    shared.map((name) => [name, { source: 'team/engineering' }]),
  );
  for (const name of shared) await install(current, '.agents/skills', name);
  await install(current, '.claude/skills', 'code-review', 'custom review');
  await install(current, '.claude/skills', 'tdd');
  await install(current, '.claude/skills', 'deploy');
  await install(current, '.hermes/skills', 'research');
  await install(current, '.hermes/skills', 'security');
  await alias(current, '.hermes/skills', 'review', join(current, '.agents/skills/code-review'));
  for (const name of ['terminal', 'incident']) await install(current, '.hermes/skills', name);
  for (const name of ['deploy', 'terminal', 'incident'])
    projectLock[name] = { source: 'team/operations' };
  await writeFile(
    join(current, 'skills-lock.json'),
    JSON.stringify({ version: 1, skills: projectLock }),
  );
  for (const name of ['code-review', 'architecture']) await install(parent, '.agents/skills', name);
  await install(parent, '.claude/skills', 'release');
  await writeFile(
    join(parent, 'skills-lock.json'),
    JSON.stringify({
      version: 1,
      skills: {
        'code-review': { source: 'team/engineering' },
        architecture: { source: 'team/engineering' },
        release: { source: 'team/operations' },
      },
    }),
  );
  await install(ancestor, '.agents/skills', 'security');
  for (const name of ['code-review', 'tdd', 'research'])
    await install(home, '.agents/skills', name);
  await alias(
    home,
    '.config/opencode/skills',
    'code-review',
    join(home, '.agents/skills/code-review'),
  );
  for (const name of ['notes', 'personal']) await install(home, '.config/opencode/skills', name);
  await install(home, '.gemini/skills', 'tdd');
  await install(home, '.gemini/skills', 'shell');
  await install(home, '.claude/skills', 'guitar');
  await writeFile(
    join(home, '.agents/.skill-lock.json'),
    JSON.stringify({
      version: 3,
      skills: {
        'code-review': { source: 'team/engineering' },
        tdd: { source: 'team/engineering' },
        research: { source: 'team/engineering' },
        notes: { source: 'personal/skills' },
        personal: { source: 'personal/skills' },
        guitar: { source: 'personal/skills' },
        shell: { source: 'team/operations' },
      },
    }),
  );
  return { current, parent, ancestor, home };
}
