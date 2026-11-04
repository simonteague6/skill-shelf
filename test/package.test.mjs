import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('packed CLI installs and runs independently of the source tree', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'skill-shelf-package-'));
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  try {
    const output = execFileSync(
      npm,
      ['pack', '--json', '--ignore-scripts', '--pack-destination', directory],
      {
        encoding: 'utf8',
      },
    );
    const [packed] = JSON.parse(output);
    assert.deepEqual(packed.files.map((file) => file.path).sort(), [
      'LICENSE',
      'README.md',
      'dist/app.js',
      'dist/cli.js',
      'dist/data.js',
      'dist/layout.js',
      'package.json',
    ]);
    execFileSync(
      npm,
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--prefix',
        directory,
        join(directory, packed.filename),
      ],
      {
        stdio: 'pipe',
      },
    );
    const cli = join(directory, 'node_modules', '@simonteague6', 'skill-shelf', 'dist', 'cli.js');
    assert.equal(packed.name, '@simonteague6/skill-shelf');
    assert.equal(
      execFileSync(
        npm,
        ['exec', '--offline', '--no', '--', '@simonteague6/skill-shelf', '--version'],
        {
          cwd: directory,
          encoding: 'utf8',
        },
      ).trim(),
      packed.version,
    );
    if (process.platform !== 'win32') {
      const bin = join(directory, 'node_modules', '.bin', 'skill-shelf');
      assert.equal(execFileSync(bin, ['--version'], { encoding: 'utf8' }).trim(), packed.version);
    }
    assert.equal(
      execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' }).trim(),
      packed.version,
    );
    assert.match(
      execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }),
      /Usage: skill-shelf/,
    );
    const result = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires an interactive terminal/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
