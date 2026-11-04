import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findProject, loadShelf } from '../dist/data.js';
import { shelfLines } from '../dist/layout.js';
import stringWidth from 'string-width';

async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'skill-shelf-'));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const dir = async (root, name) => mkdir(join(root, '.agents', 'skills', name), { recursive: true });
const lock = async (path, skills) => writeFile(path, JSON.stringify({ version: 1, skills }));

test('loading keeps the skill directory and lock unchanged and sanitizes control characters', () =>
  fixture(async (root) => {
    await dir(root, 'skill');
    const path = join(root, 'skills-lock.json');
    await lock(path, { skill: { source: 'repo/\u001b[2J' } });
    const before = await readFile(path);
    const folder = join(root, '.agents', 'skills');
    const names = await readdir(folder);
    const shelf = await loadShelf(root, 'project');
    assert.equal(shelf.skills[0].source, 'repo/�[2J');
    assert.deepEqual(await readFile(path), before);
    assert.deepEqual(await readdir(folder), names);
  }));

test('folders define inventory, independent locks supply grouping', () =>
  fixture(async (root) => {
    const project = join(root, 'project');
    const home = join(root, 'home');
    await Promise.all(['a', 'b', 'solo', 'mine'].map((name) => dir(project, name)));
    await dir(home, 'global');
    await symlink(
      join(project, '.agents', 'skills', 'a'),
      join(project, '.agents', 'skills', 'linked'),
    );
    await symlink(join(root, 'missing'), join(project, '.agents', 'skills', 'broken'));
    await writeFile(join(project, '.agents', 'skills', 'file'), 'not a directory');
    await lock(join(project, 'skills-lock.json'), {
      a: { source: 'repo/x' },
      b: { source: 'repo/x' },
      solo: { source: 'repo/y' },
      stale: { source: 'repo/x' },
    });
    await lock(join(home, '.agents', '.skill-lock.json'), {
      global: { source: 'repo/global' },
      a: { source: 'wrong' },
    });
    const p = await loadShelf(project, 'project');
    const g = await loadShelf(home, 'global');
    assert.deepEqual(
      p.skills.map((s) => s.name),
      ['a', 'b', 'linked', 'mine', 'solo'],
    );
    assert.deepEqual(
      p.groups.map((x) => [x.title, x.skills.length]),
      [
        ['repo/x', 2],
        ['Your collection', 2],
        ['Other sources', 1],
      ],
    );
    assert.equal(p.groups[2].skills[0].source, 'repo/y');
    assert.deepEqual(g.skills, [{ name: 'global', source: 'repo/global' }]);
  }));

test('missing and invalid locks preserve folders and report metadata problem', () =>
  fixture(async (root) => {
    await dir(root, 'one');
    let shelf = await loadShelf(root, 'project');
    assert.equal(shelf.notice, 'Lock file missing');
    assert.equal(shelf.groups[0].title, 'Your collection');
    await writeFile(join(root, 'skills-lock.json'), '{');
    shelf = await loadShelf(root, 'project');
    assert.equal(shelf.notice, 'Cannot read lock file');
    assert.equal(shelf.skills.length, 1);
  }));

test('discovery finds nearest marker, respects git and home boundaries', () =>
  fixture(async (root) => {
    const home = join(root, 'home');
    const repo = join(home, 'repo');
    const sub = join(repo, 'sub');
    await mkdir(join(repo, '.git'), { recursive: true });
    await mkdir(sub);
    await dir(home, 'global');
    assert.equal(await findProject(sub, home), repo);
    await dir(repo, 'repo-skill');
    await dir(sub, 'nested');
    assert.equal(await findProject(sub, home), sub);
    const outside = join(home, 'outside');
    await mkdir(outside);
    assert.equal(await findProject(outside, home), outside);
    assert.equal(await findProject(home, home), undefined);
  }));

test('empty view and narrow layout stay within terminal width', async () => {
  const empty = { skills: [], groups: [] };
  assert.equal(shelfLines(empty, 'project', 80)[0][0].text, 'No project skills');
  const shelf = {
    skills: [{ name: 'one-long-name', source: 'very-long-source' }],
    groups: [
      {
        title: 'Other sources',
        kind: 'other',
        skills: [{ name: 'one-long-name', source: 'very-long-source' }],
      },
    ],
  };
  for (const line of shelfLines(shelf, 'project', 10))
    assert.ok(line.map((s) => s.text).join('').length <= 10);
});

test('group headings and wide characters fit every terminal width', () => {
  const skill = { name: '界界', source: 'a-long-source' };
  const shelf = {
    skills: [skill],
    groups: [{ title: 'Other sources', kind: 'other', skills: [skill] }],
  };
  for (let width = 1; width <= 30; width++) {
    for (const line of shelfLines(shelf, 'project', width)) {
      assert.ok(stringWidth(line.map((span) => span.text).join('')) <= width, `width ${width}`);
    }
  }
});
