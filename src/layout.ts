import stringWidth from 'string-width';
import type { Shelf } from './data.js';

export type Span = { text: string; color?: string; bold?: boolean; dim?: boolean };
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
export function shelfLines(shelf: Shelf, scope: 'project' | 'global', width: number): Line[] {
  const lines: Line[] = [];
  if (shelf.error) return [[{ text: clip(shelf.error, width), color: '#efaaa9' }]];
  if (shelf.notice && shelf.skills.length) lines.push([{ text: clip(shelf.notice, width), dim: true }], []);
  if (!shelf.skills.length) {
    const empty: Line[] = [[{ text: clip(scope === 'project' ? 'No project skills' : 'No global skills', width), dim: true }]];
    if (shelf.notice && shelf.notice !== 'Lock file missing') empty.push([{ text: clip(shelf.notice, width), color: '#efaaa9' }]);
    return empty;
  }
  for (const group of shelf.groups) {
    const color = group.kind === 'source' ? '#8acdbd' : group.kind === 'collection' ? '#efc780' : '#9cbdf0';
    const count = String(group.skills.length);
    const title = clip(group.title, Math.max(0, width - count.length - 1));
    const gap = Math.max(1, width - stringWidth(title) - count.length);
    if (count.length >= width) lines.push([{ text: clip(count, width), dim: true }]);
    else lines.push([{ text: title, color, bold: true }, { text: ' '.repeat(gap) + count, dim: true }]);
    if (group.kind === 'other') {
      const nameWidth = Math.min(Math.max(...group.skills.map(s => stringWidth(s.name))), Math.floor(width * 0.48));
      for (const skill of group.skills) {
        if (width < 16) lines.push([{ text: clip(skill.name, width) }], [{ text: clip(skill.source ?? '', width), dim: true }]);
        else {
          const name = clip(skill.name, nameWidth);
          lines.push([{ text: name + ' '.repeat(Math.max(0, nameWidth + 2 - stringWidth(name))) }, { text: clip(skill.source ?? '', Math.max(0, width - nameWidth - 2)), dim: true }]);
        }
      }
    } else {
      const max = Math.max(...group.skills.map(s => stringWidth(s.name)));
      const cols = Math.max(1, Math.floor((width + 2) / (max + 2)));
      const colWidth = Math.floor((width + 2) / cols);
      for (let i = 0; i < group.skills.length; i += cols) {
        let text = '';
        for (let col = 0; col < cols && i + col < group.skills.length; col++) {
          const name = clip(group.skills[i + col].name, colWidth - (col === cols - 1 ? 0 : 2));
          text += col < cols - 1 && i + col + 1 < group.skills.length ? name + ' '.repeat(Math.max(0, colWidth - stringWidth(name))) : name;
        }
        lines.push([{ text: clip(text, width) }]);
      }
    }
    lines.push([]);
  }
  return lines;
}
