import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('version reflects the package metadata', () => {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(
    execFileSync(process.execPath, ['dist/cli.js', '--version'], { encoding: 'utf8' }).trim(),
    version,
  );
});

test(
  'interactive CLI selects details, navigates skills, switches scopes and restores the screen',
  { skip: process.platform === 'win32' },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'shelf-cli-'));
    try {
      const project = join(root, 'project');
      for (const [base, name] of [
        [project, 'alpha'],
        [project, 'beta'],
        [project, 'charlie'],
        [project, 'delta'],
        [root, 'global-only'],
      ]) {
        const folder = join(base, '.agents/skills', name);
        await mkdir(folder, { recursive: true });
        await writeFile(join(folder, 'SKILL.md'), name);
      }
      await writeFile(
        join(project, 'skills-lock.json'),
        JSON.stringify({
          version: 1,
          skills: {
            alpha: { source: 'repo/a' },
            beta: { source: 'repo/a' },
            charlie: { source: 'repo/b' },
            delta: { source: 'repo/b' },
          },
        }),
      );
      const result = spawnSync(
        'python3',
        [resolve('test/terminal.py'), process.execPath, resolve('dist/cli.js')],
        {
          cwd: project,
          env: { PATH: process.env.PATH, HOME: root, TERM: 'xterm-256color' },
          encoding: 'utf8',
          timeout: 30000,
          input: JSON.stringify([
            { wait: 'Enter details' },
            { keys: '\r', wait: 'Installed locations' },
            { keys: 'l', wait: 'beta' },
            { keys: 'h', wait: 'alpha' },
            { keys: '\u001b[C', wait: 'beta' },
            { keys: '\u001b[D', wait: 'alpha' },
            { keys: '\u001b', wait: 'Enter details' },
            { keys: 'j', wait: '\u001b[4mcharlie' },
            { keys: '\r', wait: 'Installed locations' },
            { keys: '\u001b', wait: 'Enter details' },
            { keys: 'k', wait: '\u001b[4malpha' },
            { keys: '\t', wait: 'global-only' },
            { keys: '\r', wait: 'Installed locations' },
            { size: [30, 12], wait: 'Esc back · ↑↓ · q quit' },
            { keys: 'j', wait: 'Esc back · ↑↓ · q quit' },
            { keys: 'k', wait: 'Source' },
            { keys: '\u001b', wait: 'Tab · hjkl · Enter · q' },
            { size: [120, 38], wait: 'Enter details' },
            { keys: 'q', wait: '\u001b[?1049l' },
          ]),
        },
      );
      assert.equal(result.status, 0, result.stderr + result.stdout);
      assert.ok(result.stdout.includes('\u001b[?1049h'));
      assert.ok(result.stdout.includes('\u001b[?25h'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

test('noninteractive use fails without entering the alternate screen', () => {
  const result = spawnSync(process.execPath, ['dist/cli.js'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires an interactive terminal/);
  assert.equal(result.stdout, '');
});
