import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  symlink,
  realpath,
  truncate,
  chmod,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { shelfLines } from '../dist/layout.js';
import { messyFixture } from './fixtures/messy.mjs';
import * as inventory from '../dist/data.js';
const { loadShelf } = inventory;

async function fixture(fn) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'shelf-inventory-')));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
async function skill(root, destination, name, text = name) {
  const folder = join(root, destination, name);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'SKILL.md'), text);
  return folder;
}

test('recognized destinations inventory only immediate folders with readable instructions', () =>
  fixture(async (root) => {
    await skill(root, '.claude/skills', 'claude');
    await skill(root, 'agent/skills', 'eve');
    await skill(root, 'data/skills', 'astrbot');
    await skill(root, '.posit/assistant/skills', 'posit');
    await skill(root, '.unknown/skills', 'ignored');
    await mkdir(join(root, '.agents/skills/empty'), { recursive: true });
    await skill(root, '.agents/skills/container/nested', 'ignored');
    await symlink(join(root, 'missing'), join(root, '.agents/skills/broken'));
    const shelf = await loadShelf(root, 'project', { env: {} });
    assert.deepEqual(
      shelf.skills.map((s) => s.name),
      ['astrbot', 'claude', 'eve', 'posit'],
    );
    assert.equal(shelf.skills.find((s) => s.name === 'claude').locations[0].label, 'Claude Code');
  }));

test('long source headings keep their adjacent count visible in narrow output', () => {
  const skills = [{ name: 'a' }, { name: 'b' }];
  const shelf = {
    skills,
    groups: [{ title: 'repository/with/a/very/long/source', skills, kind: 'source' }],
  };
  const heading = shelfLines(shelf, 'project', 24)[0]
    .map((span) => span.text)
    .join('');
  assert.equal(heading, 'repository/with/a/ve…  2');
});

test('destination display names match the pinned upstream registry', () =>
  fixture(async (root) => {
    await skill(root, '.codestudio/skills', 'studio');
    const shelf = await loadShelf(root, 'project', { env: {} });
    assert.equal(shelf.skills[0].locations[0].label, 'Code Studio');
  }));

test('ancestor notices remain visible before a long selectable inventory', () =>
  fixture(async (root) => {
    const home = join(root, 'home');
    const parent = join(home, 'project');
    const current = join(parent, 'app');
    for (let index = 0; index < 20; index++)
      await skill(current, '.agents/skills', `skill-${index}-long-name-to-force-few-columns`);
    await writeFile(join(parent, 'skills-lock.json'), '{');
    const snapshot = await inventory.loadSnapshot(current, home, {});
    const viewport = shelfLines(snapshot.project, 'project', 80)
      .slice(0, 9)
      .flatMap((line) => line.map((span) => span.text))
      .join('\n');
    assert.match(viewport, /Cannot read lock file/);
    assert.equal(snapshot.project.skills.length, 20);
  }));

test('installed locations keep Agents first and sort equal destination labels by path', () =>
  fixture(async (root) => {
    const original = await skill(root, '.agents/skills', 'alpha');
    await symlink(original, join(root, '.agents/skills/zulu'));
    await mkdir(join(root, '.claude/skills'), { recursive: true });
    await symlink(original, join(root, '.claude/skills/alpha'));
    const shelf = await loadShelf(root, 'project', { env: {} });
    assert.deepEqual(
      shelf.skills[0].locations.map((l) => l.path),
      [
        join(root, '.agents/skills/alpha'),
        join(root, '.agents/skills/zulu'),
        join(root, '.claude/skills/alpha'),
      ],
    );
  }));

test('a larger collection compares streamed supporting assets and retains all installed locations', (t) =>
  fixture(async (root) => {
    const home = join(root, 'home');
    const project = join(home, 'project');
    const asset = Buffer.alloc(32 * 1024, 0xa5);
    for (let start = 0; start < 1000; start += 32) {
      await Promise.all(
        Array.from({ length: Math.min(32, 1000 - start) }, async (_, offset) => {
          const index = start + offset;
          const name = `skill-${String(index).padStart(4, '0')}`;
          const folder = await skill(project, '.agents/skills', name);
          await writeFile(join(folder, 'asset.bin'), asset);
          if (index < 500) {
            const copy = await skill(project, '.claude/skills', name);
            await writeFile(join(copy, 'asset.bin'), asset);
          }
        }),
      );
    }
    const start = performance.now();
    const snapshot = await inventory.loadSnapshot(project, home, {});
    t.diagnostic(
      `Large startup (1,500 installations, 1,000 skills, 47 MiB supporting assets): ${(performance.now() - start).toFixed(1)} ms`,
    );
    assert.equal(snapshot.project.skills.length, 1000);
    assert.equal(
      snapshot.project.skills.reduce((n, s) => n + s.locations.length, 0),
      1500,
    );
    assert.ok(!snapshot.project.sections[0].notice?.includes('unproven'));
    assert.equal(snapshot.project.skills[0].name, 'skill-0000');
    assert.equal(snapshot.project.skills.at(-1).name, 'skill-0999');
  }));

test('global state override follows the upstream lock reader even for relative paths', () =>
  fixture(async (root) => {
    await skill(root, '.agents/skills', 'one');
    const state = join(root, 'state');
    await mkdir(join(state, 'skills'), { recursive: true });
    await writeFile(
      join(state, 'skills/.skill-lock.json'),
      JSON.stringify({ version: 3, skills: { one: { source: 'repo/relative-state' } } }),
    );
    const shelf = await loadShelf(root, 'global', {
      env: { XDG_STATE_HOME: relative(process.cwd(), state) },
    });
    assert.equal(shelf.skills[0].source, 'repo/relative-state');
  }));

test('representative multi-agent snapshot retains the independent sections and location details', (t) =>
  fixture(async (root) => {
    const paths = await messyFixture(root);
    const start = performance.now();
    const snapshot = await inventory.loadSnapshot(paths.current, root, {});
    t.diagnostic(`Messy startup snapshot: ${(performance.now() - start).toFixed(1)} ms`);
    assert.deepEqual(
      snapshot.project.sections.filter((s) => s.skills.length).map((s) => s.skills.length),
      [14, 3, 1],
    );
    assert.equal(snapshot.global.skills.length, 7);
    const review = snapshot.global.skills.find((s) => s.name === 'code-review');
    assert.deepEqual(
      review.locations.map((l) => [l.label, l.kind]),
      [
        ['Agents', undefined],
        ['OpenCode', 'linked folder'],
      ],
    );
    const tdd = snapshot.project.skills.find((s) => s.name === 'tdd');
    assert.equal(tdd.locations[1].kind, 'identical copy');
  }));

test('malformed per-skill metadata is summarized while valid skills remain visible', () =>
  fixture(async (root) => {
    await skill(root, '.agents/skills', 'one');
    await writeFile(
      join(root, 'skills-lock.json'),
      JSON.stringify({ version: 1, skills: { one: { source: 42 }, stale: null } }),
    );
    const shelf = await loadShelf(root, 'project', { env: {} });
    assert.equal(shelf.skills.length, 1);
    assert.equal(shelf.skills[0].source, undefined);
    assert.match(shelf.notice, /invalid metadata/i);
  }));

test('every pinned project and global destination contributes inventory without agent detection', () =>
  fixture(async (root) => {
    // Independent expected destinations from the pinned upstream agents.ts table.
    const projectPaths = [
      '.agents/skills',
      '.aider-desk/skills',
      'data/skills',
      '.autohand/skills',
      '.augment/skills',
      '.bob/skills',
      '.claude/skills',
      'skills',
      '.codeartsdoer/skills',
      '.codebuddy/skills',
      '.codemaker/skills',
      '.codestudio/skills',
      '.commandcode/skills',
      '.continue/skills',
      '.cortex/skills',
      '.crush/skills',
      '.devin/skills',
      'agent/skills',
      '.forge/skills',
      '.goose/skills',
      '.grok/skills',
      '.hermes/skills',
      '.inferencesh/skills',
      '.jazz/skills',
      '.junie/skills',
      '.iflow/skills',
      '.kimchi/skills',
      '.kiro/skills',
      '.kode/skills',
      '.lingma/skills',
      '.mcpjam/skills',
      '.minimax/skills',
      '.vibe/skills',
      '.moxby/skills',
      '.mux/skills',
      '.openhands/skills',
      '.ona/skills',
      '.posit/assistant/skills',
      '.qoder/skills',
      '.qwen/skills',
      '.reasonix/skills',
      '.rovodev/skills',
      '.roo/skills',
      '.tabnine/agent/skills',
      '.terramind/skills',
      '.tinycloud/skills',
      '.trae/skills',
      '.windsurf/skills',
      '.zcode/skills',
      '.zencoder/skills',
      '.neovate/skills',
      '.pochi/skills',
      '.adal/skills',
    ];
    const globalPaths = [
      '.agents/skills',
      '.aider-desk/skills',
      '.config/agents/skills',
      '.gemini/antigravity/skills',
      '.gemini/antigravity-cli/skills',
      '.astrbot/data/skills',
      '.autohand/skills',
      '.augment/skills',
      '.bob/skills',
      '.claude/skills',
      '.openclaw/skills',
      '.codeartsdoer/skills',
      '.codebuddy/skills',
      '.codemaker/skills',
      '.codestudio/skills',
      '.commandcode/skills',
      '.continue/skills',
      '.snowflake/cortex/skills',
      '.config/crush/skills',
      '.cursor/skills',
      '.deepagents/agent/skills',
      '.config/devin/skills',
      '.factory/skills',
      '.firebender/skills',
      '.forge/skills',
      '.gemini/skills',
      '.copilot/skills',
      '.config/goose/skills',
      '.grok/skills',
      '.hermes/skills',
      '.inferencesh/skills',
      '.jazz/skills',
      '.junie/skills',
      '.iflow/skills',
      '.kilo/skills',
      '.config/kimchi/harness/skills',
      '.kiro/skills',
      '.kode/skills',
      '.lingma/skills',
      '.mcpjam/skills',
      '.minimax/skills',
      '.vibe/skills',
      '.moxby/skills',
      '.mux/skills',
      '.config/opencode/skills',
      '.openhands/skills',
      '.ona/skills',
      '.posit/assistant/skills',
      '.qoder/skills',
      '.qoder-cn/skills',
      '.qwen/skills',
      '.reasonix/skills',
      '.rovodev/skills',
      '.roo/skills',
      '.tabnine/agent/skills',
      '.terramind/skills',
      '.tinycloud/skills',
      '.trae/skills',
      '.trae-cn/skills',
      '.codeium/windsurf/skills',
      '.zcode/skills',
      '.zencoder/skills',
      '.neovate/skills',
      '.pochi/skills',
      '.adal/skills',
    ];
    for (const [scope, paths] of [
      ['project', projectPaths],
      ['global', globalPaths],
    ]) {
      const base = join(root, scope);
      for (const [index, path] of paths.entries()) await skill(base, path, `skill-${index}`);
      const shelf = await loadShelf(base, scope, { env: {} });
      assert.equal(shelf.skills.length, paths.length, scope);
      for (const path of paths)
        assert.ok(
          shelf.skills.some((s) =>
            s.locations.some((l) => l.path.startsWith(`${join(base, path)}/`)),
          ),
          path,
        );
    }
  }));

test('conflicting alias metadata, terminal text, missing metadata and read failures stay observational', () =>
  fixture(async (root) => {
    const original = await skill(root, '.agents/skills', 'one');
    await mkdir(join(root, '.claude/skills'), { recursive: true });
    await symlink(original, join(root, '.claude/skills/two'));
    await skill(root, '.hermes/skills', 'unsafe\u001b]0;title\u0007\u202e');
    await writeFile(
      join(root, 'skills-lock.json'),
      JSON.stringify({
        version: 1,
        skills: { one: { source: 'repo/one' }, two: { source: 'repo/two' } },
      }),
    );
    const shelf = await loadShelf(root, 'project', { env: {} });
    assert.equal(shelf.skills.length, 2);
    assert.ok(shelf.skills.every((s) => s.source === undefined));
    const output = shelfLines(shelf, 'project', 100, { detail: shelf.skills[1] })
      .flatMap((line) => line.map((span) => span.text))
      .join('');
    assert.ok(
      !output.includes('\u001b') && !output.includes('\u0007') && !output.includes('\u202e'),
    );
    if (process.getuid && process.getuid() !== 0) {
      await chmod(join(root, '.claude/skills'), 0);
      try {
        const partial = await loadShelf(root, 'project', { env: {} });
        assert.equal(partial.skills.length, 2);
        assert.match(partial.notice, /read issues/);
      } finally {
        await chmod(join(root, '.claude/skills'), 0o700);
      }
    }
  }));

test('overview directory labels abbreviate home, stay on one row and retain left counts', () =>
  fixture(async (root) => {
    const home = join(root, 'home');
    const project = join(home, 'project');
    await skill(project, '.agents/skills', 'one');
    const snapshot = await inventory.loadSnapshot(project, home, {});
    const lines = shelfLines(snapshot.project, 'project', 24);
    assert.equal(lines[0].map((span) => span.text).join(''), '~/project  1');
    const detail = shelfLines(snapshot.project, 'project', 80, {
      detail: snapshot.project.skills[0],
    })
      .flatMap((line) => line.map((span) => span.text))
      .join('\n');
    assert.match(detail, /~\/project\/\.agents\/skills\/one/);
    assert.ok(!detail.includes(home));
    for (let width = 1; width < 40; width++) {
      for (const line of shelfLines(snapshot.project, 'project', width)) {
        assert.ok(line.map((span) => span.text).join('').length <= width);
      }
    }
  }));

test(
  'nonregular lock metadata is nonfatal and cannot block the inventory',
  { skip: process.platform === 'win32' },
  () =>
    fixture(async (root) => {
      await skill(root, '.agents/skills', 'one');
      assert.equal(spawnSync('mkfifo', [join(root, 'skills-lock.json')]).status, 0);
      const module = new URL('../dist/data.js', import.meta.url).href;
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import {loadShelf} from ${JSON.stringify(module)}; console.log(JSON.stringify(await loadShelf(${JSON.stringify(root)}, 'project', {env:{}})));`,
        ],
        { encoding: 'utf8', timeout: 2000 },
      );
      assert.equal(result.status, 0, String(result.error));
      const shelf = JSON.parse(result.stdout);
      assert.equal(shelf.skills.length, 1);
      assert.match(shelf.notice, /lock/i);
    }),
);

test('aggregate startup budget and folder entry/depth limits never hide uncertain copies', () =>
  fixture(async (root) => {
    const home = join(root, 'home');
    const project = join(home, 'project');
    const payload = 32 * 1024 * 1024 - 1;
    for (let i = 0; i < 9; i++) {
      const folder = await skill(project, '.agents/skills', `large-${i}`, 'x');
      await writeFile(join(folder, 'asset'), '');
      await truncate(join(folder, 'asset'), payload);
    }
    const first = await inventory.loadSnapshot(project, home, {});
    assert.equal(first.project.skills.length, 2);
    assert.equal(first.project.skills[0].locations.length, 8);
    assert.match(first.project.sections[0].notice, /1 comparisons unproven/);
    const second = await inventory.loadSnapshot(project, home, {});
    assert.deepEqual(second, first);
    const deep = await skill(home, '.claude/skills', 'deep');
    const deepCopy = await skill(home, '.hermes/skills', 'deep');
    for (const folder of [deep, deepCopy])
      await mkdir(join(folder, ...Array(33).fill('nested')), { recursive: true });
    const many = await skill(home, '.agents/skills', 'many');
    await Promise.all(
      Array.from({ length: 2048 }, (_, i) => writeFile(join(many, `file-${i}`), '')),
    );
    const limited = await loadShelf(home, 'global', { env: {} });
    // Global Claude/Hermes both use these home-level destinations.
    assert.equal(limited.skills.length, 3);
    assert.match(limited.notice, /3 comparisons unproven/);
    await rm(join(many, 'file-2047'));
    await rm(join(many, 'file-2046'));
    for (const folder of [deep, deepCopy]) {
      await rm(join(folder, ...Array(33).fill('nested')), { recursive: true });
    }
    const boundaries = await loadShelf(home, 'global', { env: {} });
    assert.equal(boundaries.skills.length, 2);
    assert.ok(!boundaries.notice?.includes('unproven'));
  }));

test('comparison limits, cycles and unreadable support files preserve copies with concise notices', () =>
  fixture(async (root) => {
    const a = await skill(root, '.agents/skills', 'large', 'x');
    const b = await skill(root, '.claude/skills', 'large', 'x');
    for (const folder of [a, b]) {
      await writeFile(join(folder, 'asset'), '');
      // Instructions + binary payload are exactly the 32 MiB folder budget.
      await truncate(join(folder, 'asset'), 32 * 1024 * 1024 - 1);
    }
    assert.equal((await loadShelf(root, 'project', { env: {} })).skills.length, 1);
    for (const folder of [a, b]) await truncate(join(folder, 'asset'), 32 * 1024 * 1024);
    const exceeded = await loadShelf(root, 'project', { env: {} });
    assert.equal(exceeded.skills.length, 2);
    assert.match(exceeded.notice, /2 comparisons unproven; entries kept/);
    await rm(join(a, 'asset'));
    await rm(join(b, 'asset'));
    await symlink(a, join(a, 'cycle'));
    await symlink(b, join(b, 'cycle'));
    await mkdir(join(root, '.goose/skills'), { recursive: true });
    await symlink(a, join(root, '.goose/skills/alias'));
    const cyclic = await loadShelf(root, 'project', { env: {} });
    assert.equal(cyclic.skills.length, 2);
    assert.equal(cyclic.skills[0].locations.length, 2);
    assert.match(cyclic.notice, /2 comparisons unproven/);
    await rm(join(a, 'cycle'));
    await rm(join(b, 'cycle'));
    await writeFile(join(a, 'secret'), 'secret');
    await writeFile(join(b, 'secret'), 'secret');
    await chmod(join(a, 'secret'), 0);
    try {
      if (process.getuid && process.getuid() !== 0) {
        const unreadable = await loadShelf(root, 'project', { env: {} });
        assert.equal(unreadable.skills.length, 2);
        assert.match(unreadable.notice, /comparisons unproven/);
      }
    } finally {
      await chmod(join(a, 'secret'), 0o600);
    }
    if (process.platform !== 'win32') {
      assert.equal(spawnSync('mkfifo', [join(a, 'pipe'), join(b, 'pipe')]).status, 0);
      const special = await loadShelf(root, 'project', { env: {} });
      assert.equal(special.skills.length, 2);
      assert.match(special.notice, /2 comparisons unproven/);
    }
  }));

test('rendered overview separates levels, keeps counts left and traverses displayed alphabetical groups', () =>
  fixture(async (root) => {
    for (const name of ['zeta', 'alpha', 'mine', 'solo']) await skill(root, '.agents/skills', name);
    await writeFile(
      join(root, 'skills-lock.json'),
      JSON.stringify({
        version: 1,
        skills: {
          zeta: { source: 'repo/z' },
          alpha: { source: 'repo/z' },
          solo: { source: 'repo/a' },
        },
      }),
    );
    const shelf = await loadShelf(root, 'project', { env: {} });
    const project = {
      skills: shelf.skills,
      groups: [],
      sections: [{ ...shelf, directory: root, label: '~/project' }],
    };
    const lines = shelfLines(project, 'project', 80);
    const text = lines.map((line) => line.map((span) => span.text).join('')).join('\n');
    assert.match(text, /repo\/z {2}2\n/);
    assert.match(text, /Your collection {2}1/);
    assert.ok(text.indexOf('~/project') < text.indexOf('repo/z'));
    assert.deepEqual(
      lines.flatMap((line) => line.flatMap((span) => (span.skill ? [span.skill.name] : []))),
      ['alpha', 'zeta', 'mine', 'solo'],
    );
    const detail = shelfLines(project, 'project', 24, { detail: shelf.skills[0] })
      .flatMap((line) => line.map((span) => span.text))
      .join('\n');
    assert.match(detail, /Source/);
    assert.match(detail, /Installed locations/);
    assert.match(detail, /Agents/);
  }));

test('global overrides and deliberate lock schemas supply metadata without name-collision attribution', () =>
  fixture(async (root) => {
    const env = {
      XDG_CONFIG_HOME: join(root, 'config'),
      XDG_STATE_HOME: join(root, 'state'),
      CLAUDE_CONFIG_DIR: join(root, 'claude'),
      HERMES_HOME: join(root, 'hermes'),
      VIBE_HOME: join(root, 'vibe'),
      AUTOHAND_HOME: join(root, 'auto'),
      GROK_HOME: join(root, 'grok'),
      REASONIX_HOME: join(root, 'reason'),
    };
    await skill(env.XDG_CONFIG_HOME, 'opencode/skills', 'open');
    for (const [key, folder] of Object.entries(env).filter(([key]) => !key.startsWith('XDG')))
      await skill(folder, 'skills', key);
    await mkdir(join(env.XDG_STATE_HOME, 'skills'), { recursive: true });
    await writeFile(
      join(env.XDG_STATE_HOME, 'skills/.skill-lock.json'),
      JSON.stringify({
        version: 3,
        skills: { open: { source: 'repo/open' }, stale: { source: 'not-installed' } },
      }),
    );
    const shelf = await loadShelf(root, 'global', { env });
    assert.equal(shelf.skills.length, 7);
    assert.equal(shelf.skills.find((s) => s.name === 'open').source, 'repo/open');
    await skill(root, '.agents/skills', 'collision', 'one');
    await skill(root, '.claude/skills', 'collision', 'two');
    await writeFile(
      join(root, 'skills-lock.json'),
      JSON.stringify({ version: 1, skills: { collision: { source: 'repo/ambiguous' } } }),
    );
    const project = await loadShelf(root, 'project', { env: {} });
    assert.equal(project.skills.length, 2);
    assert.ok(project.skills.every((s) => s.source === undefined));
    await writeFile(
      join(root, 'skills-lock.json'),
      JSON.stringify({ version: 99, skills: { collision: { source: 'repo/future' } } }),
    );
    assert.match((await loadShelf(root, 'project', { env: {} })).notice, /lock/i);
  }));

test('startup snapshot keeps nearest-first ancestors above git separate from home and Global', () =>
  fixture(async (root) => {
    const home = join(root, 'home');
    const parent = join(home, 'projects');
    const repo = join(parent, 'repo');
    const start = join(repo, 'child');
    await mkdir(join(repo, '.git'), { recursive: true });
    for (const level of [home, parent, repo, start])
      await skill(level, '.agents/skills', 'same', 'same');
    const snapshot = await inventory.loadSnapshot(start, home, {});
    assert.deepEqual(
      snapshot.project.sections.map((s) => s.directory),
      [start, repo, parent],
    );
    assert.equal(snapshot.project.skills.length, 3);
    assert.equal(snapshot.global.skills.length, 1);
    assert.equal((await inventory.loadSnapshot(home, home, {})).project.skills.length, 0);
    const alias = join(root, 'home-alias');
    await symlink(home, alias);
    assert.equal((await inventory.loadSnapshot(alias, home, {})).project.skills.length, 0);
    const outside = await inventory.loadSnapshot(root, home, {});
    assert.equal(outside.project.sections[0].directory, root);
    assert.equal(outside.project.sections.at(-1).directory, '/');
  }));

test('aliases and complete equal copies collapse within a level but binary differences survive', () =>
  fixture(async (root) => {
    const original = await skill(root, '.agents/skills', 'alpha', 'instructions');
    const copy = await skill(root, '.claude/skills', 'alpha', 'instructions');
    const changed = await skill(root, '.hermes/skills', 'alpha', 'instructions');
    for (const folder of [original, copy])
      await writeFile(join(folder, 'asset.bin'), Buffer.from([0, 255, 1]));
    await writeFile(join(changed, 'asset.bin'), Buffer.from([0, 255, 2]));
    await mkdir(join(root, '.goose/skills'), { recursive: true });
    await symlink(original, join(root, '.goose/skills/alias'));
    const shelf = await loadShelf(root, 'project', { env: {} });
    assert.equal(shelf.skills.length, 2);
    assert.deepEqual(
      shelf.skills[0].locations.map((l) => l.label),
      ['Agents', 'Claude Code', 'Goose'],
    );
    assert.equal(shelf.skills[0].locations[1].kind, 'identical copy');
    assert.equal(shelf.skills[0].locations[2].kind, 'linked folder');
  }));
