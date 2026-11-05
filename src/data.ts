import { readdir, stat, lstat, realpath, open, opendir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { destinations } from './registry.js';

export type Location = { path: string; label: string; kind?: 'linked folder' | 'identical copy' };
export type Skill = { name: string; source?: string; locations?: Location[] };
export type Group = { title: string; skills: Skill[]; kind: 'source' | 'collection' | 'other' };
export type Section = {
  directory: string;
  label?: string;
  skills: Skill[];
  groups: Group[];
  notice?: string;
};
export type Shelf = {
  skills: Skill[];
  groups: Group[];
  sections?: Section[];
  home?: string;
  notice?: string;
  error?: string;
};

const clean = (text: string) =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Strip terminal control characters from untrusted names.
  text.replace(/[\u0000-\u001f\u007f-\u009f\u2028-\u202e\u2066-\u2069]/g, '�');
const compare = (a: string, b: string) => a.localeCompare(b, 'en') || (a < b ? -1 : a > b ? 1 : 0);

// Copy equality is deliberately conservative. Internal links and special files
// cannot prove equality; resolved installation aliases still collapse safely.
const folderBudget = 32 * 1024 * 1024;
const snapshotBudget = 256 * 1024 * 1024;
async function fingerprint(folder: string, budget: { bytes: number; entries: number }) {
  const hash = createHash('sha256');
  let bytes = 0;
  let entries = 0;
  async function walk(path: string, relative: string, depth: number): Promise<void> {
    if (depth > 32) throw new Error('comparison depth');
    const before = await lstat(path);
    if (++entries > 2048 || ++budget.entries > 16384) throw new Error('comparison entries');
    if (before.isSymbolicLink() || (!before.isDirectory() && !before.isFile()))
      throw new Error('unsupported entry');
    hash.update(
      JSON.stringify([
        relative,
        before.isDirectory() ? 'directory' : 'file',
        before.isFile() ? before.size : 0,
      ]),
    );
    if (before.isDirectory()) {
      const names: string[] = [];
      for await (const entry of await opendir(path)) {
        names.push(entry.name);
        if (names.length + entries > 2048 || names.length + budget.entries > 16384)
          throw new Error('comparison entries');
      }
      for (const name of names.sort())
        await walk(join(path, name), relative ? `${relative}/${name}` : name, depth + 1);
    } else {
      bytes += before.size;
      budget.bytes += before.size;
      if (bytes > folderBudget || budget.bytes > snapshotBudget)
        throw new Error('comparison bytes');
      const file = await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const opened = await file.stat();
        if (!opened.isFile() || opened.ino !== before.ino || opened.dev !== before.dev)
          throw new Error('changed file');
        const buffer = Buffer.alloc(64 * 1024);
        let remaining = before.size;
        while (remaining) {
          const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, remaining));
          if (!bytesRead) throw new Error('changed file');
          hash.update(buffer.subarray(0, bytesRead));
          remaining -= bytesRead;
        }
      } finally {
        await file.close();
      }
    }
    const after = await lstat(path);
    if (
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs ||
      before.size !== after.size ||
      before.ino !== after.ino
    )
      throw new Error('changed entry');
  }
  await walk(folder, '', 0);
  return hash.digest('hex');
}

export function groupSkills(skills: Skill[]): Group[] {
  const sources = new Map<string, Skill[]>();
  const collection: Skill[] = [];
  for (const skill of skills) {
    if (!skill.source) collection.push(skill);
    else sources.set(skill.source, [...(sources.get(skill.source) ?? []), skill]);
  }
  const groups: Group[] = [];
  const other: Skill[] = [];
  for (const [source, entries] of [...sources].sort(([a], [b]) => compare(a, b))) {
    if (entries.length > 1) groups.push({ title: source, skills: entries, kind: 'source' });
    else other.push(...entries);
  }
  if (collection.length)
    groups.push({ title: 'Your collection', skills: collection, kind: 'collection' });
  if (other.length)
    groups.push({
      title: 'Other sources',
      skills: other.sort((a, b) => compare(a.name, b.name)),
      kind: 'other',
    });
  return groups;
}

export async function loadShelf(
  base: string,
  scope: 'project' | 'global',
  options: { env?: NodeJS.ProcessEnv; comparisonBudget?: { bytes: number; entries: number } } = {},
): Promise<Shelf> {
  const found: (Skill & { folder: string; target: string; names: string[] })[] = [];
  let readFailures = 0;
  for (const { path: directory, label } of await destinations(
    base,
    scope,
    options.env ?? process.env,
  )) {
    try {
      for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
        compare(a.name, b.name),
      )) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        const path = join(directory, entry.name);
        try {
          if (!(await stat(path)).isDirectory()) continue;
          if (!(await stat(join(path, 'SKILL.md'))).isFile()) continue;
          const instructions = await open(
            join(path, 'SKILL.md'),
            constants.O_RDONLY | constants.O_NONBLOCK,
          );
          try {
            if (!(await instructions.stat()).isFile()) continue;
            await instructions.read(Buffer.alloc(1), 0, 1, 0);
          } finally {
            await instructions.close();
          }
          found.push({
            name: clean(entry.name),
            names: [entry.name],
            folder: path,
            target: await realpath(path),
            locations: [
              {
                path: clean(path),
                label,
                kind: entry.isSymbolicLink() ? 'linked folder' : undefined,
              },
            ],
          });
        } catch (error) {
          if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? ''))
            readFailures++;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') readFailures++;
    }
  }
  const env = options.env ?? process.env;
  const lockPath =
    scope === 'global'
      ? env.XDG_STATE_HOME
        ? join(env.XDG_STATE_HOME, 'skills/.skill-lock.json')
        : join(base, '.agents/.skill-lock.json')
      : join(base, 'skills-lock.json');
  let lock: Record<string, unknown> = {};
  let notice: string | undefined;
  try {
    const file = await open(lockPath, constants.O_RDONLY | constants.O_NONBLOCK);
    let text: string;
    try {
      const metadata = await file.stat();
      if (!metadata.isFile() || metadata.size > 4 * 1024 * 1024) throw new Error('Invalid lock');
      const buffer = Buffer.alloc(4 * 1024 * 1024 + 1);
      let size = 0;
      while (size < buffer.length) {
        const { bytesRead } = await file.read(buffer, size, buffer.length - size);
        if (!bytesRead) break;
        size += bytesRead;
      }
      if (size === buffer.length) throw new Error('Lock budget');
      text = buffer.subarray(0, size).toString('utf8');
    } finally {
      await file.close();
    }
    const parsed: unknown = JSON.parse(text);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('version' in parsed) ||
      parsed.version !== (scope === 'project' ? 1 : 3) ||
      !('skills' in parsed) ||
      !parsed.skills ||
      typeof parsed.skills !== 'object' ||
      Array.isArray(parsed.skills)
    )
      throw new Error('Invalid lock');
    lock = parsed.skills as Record<string, unknown>;
    const invalid = Object.values(lock).filter(
      (entry) =>
        !entry ||
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        !('source' in entry) ||
        typeof entry.source !== 'string' ||
        !entry.source.trim(),
    ).length;
    if (invalid) notice = `${invalid} invalid metadata entries ignored`;
  } catch (error) {
    notice =
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'Lock file missing'
        : 'Cannot read lock file';
  }
  const collapsed: typeof found = [];
  const targets = new Map<string, (typeof found)[number]>();
  const hashes = new Map<string, (typeof found)[number]>();
  const budget = options.comparisonBudget ?? { bytes: 0, entries: 0 };
  let uncertain = 0;
  for (const skill of found) {
    const alias = targets.get(skill.target);
    if (alias) {
      alias.locations?.push(...(skill.locations ?? []));
      alias.names.push(...skill.names);
      continue;
    }
    let digest: string | undefined;
    try {
      digest = await fingerprint(skill.target, budget);
    } catch {
      uncertain++;
    }
    const equal = digest ? hashes.get(digest) : undefined;
    if (equal) {
      for (const location of skill.locations ?? [])
        if (!location.kind) location.kind = 'identical copy';
      equal.locations?.push(...(skill.locations ?? []));
      equal.names.push(...skill.names);
      targets.set(skill.target, equal);
    } else {
      collapsed.push(skill);
      targets.set(skill.target, skill);
      if (digest) hashes.set(digest, skill);
    }
  }
  const nameCounts = new Map<string, number>();
  for (const skill of collapsed)
    for (const name of new Set(skill.names)) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  const skills = collapsed
    .sort((a, b) => compare(a.name, b.name))
    .map((skill) => {
      const sources = new Set<string>();
      let ambiguous = false;
      for (const name of skill.names) {
        const entry = Object.hasOwn(lock, name) ? lock[name] : undefined;
        if (!entry) continue;
        if ((nameCounts.get(name) ?? 0) > 1) ambiguous = true;
        if (
          typeof entry === 'object' &&
          'source' in entry &&
          typeof entry.source === 'string' &&
          entry.source.trim()
        )
          sources.add(clean(entry.source));
      }
      const source = !ambiguous && sources.size === 1 ? [...sources][0] : undefined;
      return {
        name: skill.name,
        locations: skill.locations?.sort(
          (a, b) =>
            Number(b.label === 'Agents') - Number(a.label === 'Agents') ||
            compare(a.label, b.label) ||
            compare(a.path, b.path),
        ),
        source,
      };
    });
  if (readFailures)
    notice = `${readFailures} location or skill read issues${notice ? ` · ${notice}` : ''}`;
  if (uncertain)
    notice = `${uncertain} comparisons unproven; entries kept${notice ? ` · ${notice}` : ''}`;
  return {
    skills,
    groups: groupSkills(skills),
    home: scope === 'global' ? clean(base) : undefined,
    notice,
    error: undefined,
  };
}

export async function loadSnapshot(
  start: string,
  home = homedir(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ project: Shelf; global: Shelf }> {
  const comparisonBudget = { bytes: 0, entries: 0 };
  const sections: Section[] = [];
  let current = resolve(start);
  let homePath = resolve(home);
  // Physical paths keep launch-directory symlinks from leaking home into Project.
  try {
    current = await realpath(current);
  } catch {
    /* The loader reports read failures. */
  }
  try {
    homePath = await realpath(homePath);
  } catch {
    /* Injectable homes need not exist. */
  }
  while (current !== homePath) {
    const shelf = await loadShelf(current, 'project', { env, comparisonBudget });
    sections.push({
      directory: clean(current),
      label: clean(
        current.startsWith(homePath + sep) ? `~${current.slice(homePath.length)}` : current,
      ),
      skills: shelf.skills,
      groups: shelf.groups,
      notice: shelf.notice,
    });
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return {
    project: {
      skills: sections.flatMap((section) => section.skills),
      groups: [],
      sections,
      home: clean(homePath),
    },
    global: await loadShelf(homePath, 'global', { env, comparisonBudget }),
  };
}
