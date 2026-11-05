import { readFile } from 'node:fs/promises';
import { assertLatestNotNewer } from './registry.mjs';

const { name, version } = JSON.parse(await readFile('package.json', 'utf8'));
await assertLatestNotNewer(name, version);
