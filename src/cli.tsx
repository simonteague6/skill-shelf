#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { App } from './app.js';
import { findProject, loadShelf } from './data.js';

async function main() {
  if (process.argv.slice(2).includes('--version')) { console.log((createRequire(import.meta.url)('../package.json') as { version: string }).version); return; }
  if (process.argv.slice(2).includes('--help')) { console.log('Usage: skill-shelf\n\nBrowse project and global skills. Run in an interactive terminal.'); return; }
  if (process.argv.length > 2) { console.error('Usage: skill-shelf'); process.exitCode = 2; return; }
  if (!process.stdin.isTTY || !process.stdout.isTTY) { console.error('Skill Shelf requires an interactive terminal.'); process.exitCode = 1; return; }
  const root = await findProject(process.cwd());
  const [project, global] = await Promise.all([root ? loadShelf(root, 'project') : Promise.resolve({ skills: [], groups: [] }), loadShelf(homedir(), 'global')]);
  process.stdout.write('\x1b[?1049h\x1b[?25l');
  try {
    const app = render(<App project={project} global={global} />, { exitOnCtrlC: false });
    await app.waitUntilExit();
  } finally {
    process.stdout.write('\x1b[?25h\x1b[?1049l');
  }
}
main().catch(error => { console.error(`Skill Shelf: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
