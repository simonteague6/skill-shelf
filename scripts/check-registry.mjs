import { readFile } from 'node:fs/promises';
import { publicationNeeded } from './registry.mjs';

const { name, version } = JSON.parse(await readFile('package.json', 'utf8'));
console.log(`publish=${await publicationNeeded(name, version)}`);
