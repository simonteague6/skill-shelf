import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const validator = resolve('scripts/check-release.mjs');

async function withRepository(run) {
  const directory = await mkdtemp(join(tmpdir(), 'skill-shelf-release-'));
  const git = (...args) => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
  try {
    git('init', '-b', 'main');
    git('config', 'user.name', 'Release test');
    git('config', 'user.email', 'release@example.invalid');
    await writeFile(join(directory, 'package.json'), JSON.stringify({ version: '1.2.3' }));
    await writeFile(
      join(directory, 'package-lock.json'),
      JSON.stringify({ version: '1.2.3', packages: { '': { version: '1.2.3' } } }),
    );
    git('add', '.');
    git('commit', '-m', 'test fixture');
    git('tag', 'v1.2.3');
    await run({ directory, git });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('release validator accepts a matching stable tag on main', async () => {
  await withRepository(({ directory }) => {
    const result = spawnSync(process.execPath, [validator, 'v1.2.3', 'main'], {
      cwd: directory,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  });
});

test('release validator rejects a tag that does not point at the checked-out release commit', async () => {
  await withRepository(async ({ directory, git }) => {
    await writeFile(join(directory, 'later.txt'), 'later commit');
    git('add', '.');
    git('commit', '-m', 'later commit');
    const result = spawnSync(process.execPath, [validator, 'v1.2.3', 'main'], {
      cwd: directory,
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /tag must point/);
  });
});

test('release validator rejects mismatched, prerelease, and noncanonical tags', async () => {
  await withRepository(({ directory }) => {
    for (const tag of ['v1.2.4', 'v1.2.3-beta.1', 'v1.2.3+build', 'v01.2.3', '1.2.3', 'v1.2']) {
      const result = spawnSync(process.execPath, [validator, tag, 'main'], {
        cwd: directory,
        encoding: 'utf8',
      });
      assert.notEqual(result.status, 0, tag);
      assert.match(result.stderr, /Release tag/);
    }
  });
});

test('release validator requires both lockfile versions to match', async () => {
  await withRepository(async ({ directory }) => {
    for (const lock of [
      { version: '1.2.2', packages: { '': { version: '1.2.3' } } },
      { version: '1.2.3', packages: { '': { version: '1.2.2' } } },
      { version: '1.2.3' },
    ]) {
      await writeFile(join(directory, 'package-lock.json'), JSON.stringify(lock));
      const result = spawnSync(process.execPath, [validator, 'v1.2.3', 'main'], {
        cwd: directory,
        encoding: 'utf8',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /package-lock.json versions/);
    }
  });
});

test('release validator rejects commits outside main and missing main refs', async () => {
  await withRepository(async ({ directory, git }) => {
    git('checkout', '-b', 'feature');
    await writeFile(join(directory, 'feature.txt'), 'not reviewed');
    git('add', '.');
    git('commit', '-m', 'feature commit');
    for (const mainRef of ['main', 'missing-ref', undefined]) {
      const args = [validator, 'v1.2.3'];
      if (mainRef) args.push(mainRef);
      const result = spawnSync(process.execPath, args, { cwd: directory, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
    }
  });
});
