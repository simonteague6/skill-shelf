import { readdir, readFile, stat, lstat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export type Skill = { name: string; source?: string };
export type Group = { title: string; skills: Skill[]; kind: 'source' | 'collection' | 'other' };
export type Shelf = { skills: Skill[]; groups: Group[]; notice?: string; error?: string };

const exists = async (path: string) => {
  try { await lstat(path); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
};

// The home directory is a boundary, not a project marker: it contains global skills.
export async function findProject(start: string, home = homedir()): Promise<string | undefined> {
  let current = resolve(start);
  const homePath = resolve(home);
  while (true) {
    if (current === homePath) return resolve(start) === homePath ? undefined : resolve(start);
    if (await exists(join(current, 'skills-lock.json')) || await exists(join(current, '.agents', 'skills'))) return current;
    if (await exists(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

const clean = (text: string) => text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, '�');
const compare = (a: string, b: string) => a.localeCompare(b, 'en');

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
  if (collection.length) groups.push({ title: 'Your collection', skills: collection, kind: 'collection' });
  if (other.length) groups.push({ title: 'Other sources', skills: other.sort((a, b) => compare(a.name, b.name)), kind: 'other' });
  return groups;
}

export async function loadShelf(base: string, scope: 'project' | 'global'): Promise<Shelf> {
  const directory = join(base, '.agents', 'skills');
  const lockPath = scope === 'global' ? join(base, '.agents', '.skill-lock.json') : join(base, 'skills-lock.json');
  let names: string[];
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const candidates = await Promise.all(entries.map(async entry => {
      if (entry.isDirectory()) return entry.name;
      if (entry.isSymbolicLink()) {
        try { return (await stat(join(directory, entry.name))).isDirectory() ? entry.name : undefined; }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
      }
      return undefined;
    }));
    names = candidates.filter((name): name is string => name !== undefined).sort(compare);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') names = [];
    else return { skills: [], groups: [], error: `Cannot read skills: ${(error as NodeJS.ErrnoException).code ?? 'error'}` };
  }
  let lock: Record<string, unknown> = {};
  let notice: string | undefined;
  try {
    const parsed: unknown = JSON.parse(await readFile(lockPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !('skills' in parsed) || !parsed.skills || typeof parsed.skills !== 'object' || Array.isArray(parsed.skills)) throw new Error('Invalid lock');
    lock = parsed.skills as Record<string, unknown>;
  } catch (error) {
    notice = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'Lock file missing' : 'Cannot read lock file';
  }
  const skills = names.map(name => {
    const entry = Object.hasOwn(lock, name) ? lock[name] : undefined;
    const source = entry && typeof entry === 'object' && 'source' in entry && typeof entry.source === 'string' && entry.source.trim() ? clean(entry.source) : undefined;
    return { name: clean(name), source };
  });
  return { skills, groups: groupSkills(skills), notice, error: undefined };
}
