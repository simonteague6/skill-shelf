import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('version reflects the package metadata', () => {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(execFileSync(process.execPath, ['dist/cli.js', '--version'], { encoding: 'utf8' }).trim(), version);
});

test('noninteractive use fails without entering the alternate screen', () => {
  const result = spawnSync(process.execPath, ['dist/cli.js'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires an interactive terminal/);
  assert.equal(result.stdout, '');
});
