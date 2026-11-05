import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const [tag, mainRef] = process.argv.slice(2);
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));

if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
  throw new Error('Release tag must be a stable vMAJOR.MINOR.PATCH version.');
}
if (tag !== `v${manifest.version}`) {
  throw new Error('Release tag must match package.json version.');
}
if (lock.version !== manifest.version || lock.packages?.['']?.version !== manifest.version) {
  throw new Error('package-lock.json versions must match package.json.');
}
if (!mainRef) throw new Error('Main branch reference is required.');
execFileSync('git', ['merge-base', '--is-ancestor', 'HEAD', mainRef], { stdio: 'pipe' });
const revision = (ref) =>
  execFileSync('git', ['rev-parse', '--verify', ref], { encoding: 'utf8' }).trim();
if (revision(`refs/tags/${tag}^{commit}`) !== revision('HEAD')) {
  throw new Error('Release tag must point at the checked-out release commit.');
}
console.log(`Validated ${tag} on ${mainRef}.`);
