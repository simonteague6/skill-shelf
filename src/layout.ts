import stringWidth from 'string-width';
import type { Shelf, Skill } from './data.js';

export type Span = {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
  skill?: Skill;
  underline?: boolean;
};
export type Line = Span[];
const clip = (text: string, width: number): string => {
  if (width <= 0) return '';
  if (stringWidth(text) <= width) return text;
  let result = '';
  for (const char of text) {
    if (stringWidth(result + char) > Math.max(0, width - 1)) break;
    result += char;
  }
  return result + (width > 0 ? '…' : '');
};
export function shelfLines(
  shelf: Shelf,
  scope: 'project' | 'global',
  width: number,
  options: { selected?: Skill; detail?: Skill } = {},
): Line[] {
  const lines: Line[] = [];
  const wrapped = (text: string, color?: string) => {
    let line = '';
    for (const char of text) {
      if (stringWidth(line + char) > width) {
        if (line) lines.push([{ text: line, color }]);
        line = '';
      }
      line += stringWidth(char) > width ? '�' : char;
    }
    if (line) lines.push([{ text: line, color }]);
  };
  if (options.detail) {
    const skill = options.detail;
    wrapped(skill.name, '#efc780');
    const section = shelf.sections?.find((section) => section.skills.includes(skill));
    const directory = section?.label ?? section?.directory;
    if (directory) wrapped(directory, '#9cbdf0');
    lines.push([], [{ text: clip('Source', width), color: '#8acdbd', bold: true }]);
    wrapped(skill.source ?? 'Your collection');
    lines.push([], [{ text: clip('Installed locations', width), color: '#8acdbd', bold: true }]);
    for (const location of skill.locations ?? []) {
      wrapped(`${location.label}${location.kind ? ` · ${location.kind}` : ''}`);
      const suffix = shelf.home ? location.path.slice(shelf.home.length) : '';
      const path =
        shelf.home &&
        location.path.startsWith(shelf.home) &&
        (suffix.startsWith('/') || suffix.startsWith('\\'))
          ? `~${suffix}`
          : location.path;
      wrapped(path, '#9cbdf0');
      lines.push([]);
    }
    return lines;
  }
  if (shelf.sections) {
    for (const section of shelf.sections) {
      if (!section.skills.length && (!section.notice || section.notice === 'Lock file missing'))
        continue;
      const count = `  ${section.skills.length}`;
      lines.push([
        {
          text:
            clip(section.label ?? section.directory, Math.max(0, width - count.length)) +
            clip(count, Math.min(width, count.length)),
          color: '#9cbdf0',
          bold: true,
        },
      ]);
      lines.push([]);
      lines.push(...shelfLines(section, scope, width, options), []);
    }
    if (lines.length) return lines;
  }
  if (shelf.error) return [[{ text: clip(shelf.error, width), color: '#efaaa9' }]];
  if (shelf.notice && shelf.notice !== 'Lock file missing' && shelf.skills.length)
    lines.push([{ text: clip(shelf.notice, width), dim: true }], []);
  if (!shelf.skills.length) {
    const empty: Line[] = [
      [
        {
          text: clip(scope === 'project' ? 'No project skills' : 'No global skills', width),
          dim: true,
        },
      ],
    ];
    if (shelf.notice && shelf.notice !== 'Lock file missing')
      empty.push([{ text: clip(shelf.notice, width), color: '#efaaa9' }]);
    return empty;
  }
  for (const group of shelf.groups) {
    const color =
      group.kind === 'source' ? '#8acdbd' : group.kind === 'collection' ? '#efc780' : '#9cbdf0';
    const count = `  ${group.skills.length}`;
    lines.push([
      {
        text:
          clip(group.title, Math.max(0, width - count.length)) +
          clip(count, Math.min(width, count.length)),
        color,
        bold: true,
      },
    ]);
    if (group.kind === 'other') {
      const nameWidth = Math.min(
        Math.max(...group.skills.map((s) => stringWidth(s.name))),
        Math.floor(width * 0.48),
      );
      for (const skill of group.skills) {
        if (width < 16)
          lines.push(
            [{ text: clip(skill.name, width), skill, underline: skill === options.selected }],
            [{ text: clip(skill.source ?? '', width), dim: true }],
          );
        else {
          const name = clip(skill.name, nameWidth);
          lines.push([
            { text: name, skill, underline: skill === options.selected },
            { text: ' '.repeat(Math.max(0, nameWidth + 2 - stringWidth(name))) },
            { text: clip(skill.source ?? '', Math.max(0, width - nameWidth - 2)), dim: true },
          ]);
        }
      }
    } else {
      const max = Math.max(...group.skills.map((s) => stringWidth(s.name)));
      const cols = Math.max(1, Math.floor((width + 2) / (max + 2)));
      const colWidth = Math.floor((width + 2) / cols);
      for (let i = 0; i < group.skills.length; i += cols) {
        const spans: Span[] = [];
        for (let col = 0; col < cols && i + col < group.skills.length; col++) {
          const skill = group.skills[i + col];
          const name = clip(skill.name, Math.min(width, colWidth - (col === cols - 1 ? 0 : 2)));
          spans.push({ text: name, skill, underline: skill === options.selected });
          if (col < cols - 1 && i + col + 1 < group.skills.length)
            spans.push({ text: ' '.repeat(Math.max(0, colWidth - stringWidth(name))) });
        }
        lines.push(spans);
      }
    }
    lines.push([]);
  }
  return lines;
}
