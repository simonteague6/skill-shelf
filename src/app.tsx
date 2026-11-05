import { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import stringWidth from 'string-width';
import type { Shelf } from './data.js';
import { shelfLines } from './layout.js';

export function App({ project, global }: { project: Shelf; global: Shelf }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => ({
    columns: stdout.columns || 80,
    rows: stdout.rows || 24,
  }));
  const [scope, setScope] = useState<'project' | 'global'>('project');
  const [selection, setSelection] = useState({ project: 0, global: 0 });
  const [details, setDetails] = useState(false);
  const [detailOffset, setDetailOffset] = useState(0);
  useEffect(() => {
    const resize = () => setSize({ columns: stdout.columns || 80, rows: stdout.rows || 24 });
    stdout.on('resize', resize);
    return () => {
      stdout.off('resize', resize);
    };
  }, [stdout]);
  const width = Math.max(1, size.columns);
  const height = Math.max(1, size.rows);
  const padding = width >= 20 ? 2 : 0;
  const inner = Math.max(1, width - padding * 2);
  const shelf = scope === 'project' ? project : global;
  const overview = shelfLines(shelf, scope, inner);
  const cells = overview.flatMap((line, row) =>
    line.flatMap((span) => (span.skill ? [{ skill: span.skill, row }] : [])),
  );
  const selected = Math.max(0, Math.min(selection[scope], cells.length - 1));
  const chosen = cells[selected];
  const lines = shelfLines(shelf, scope, inner, {
    selected: chosen?.skill,
    detail: details ? chosen?.skill : undefined,
  });
  const headerHeight = height >= 5 ? 2 : 1;
  const footerHeight = height >= 3 ? 1 : 0;
  const available = Math.max(0, height - headerHeight - footerHeight);
  const maxOffset = Math.max(0, lines.length - available);
  const offset = details
    ? Math.min(detailOffset, maxOffset)
    : Math.min(maxOffset, Math.max(0, (chosen?.row ?? 0) - available + 2));
  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
      return;
    }
    if (key.tab) {
      setScope((value) => (value === 'project' ? 'global' : 'project'));
      setDetails(false);
      setDetailOffset(0);
      return;
    }
    if (key.escape || (key.return && details)) {
      setDetails(false);
      return;
    }
    if (key.return && chosen) {
      setDetails(true);
      setDetailOffset(0);
      return;
    }
    const delta = key.downArrow || input === 'j' ? 1 : key.upArrow || input === 'k' ? -1 : 0;
    if (details && delta) {
      setDetailOffset(Math.max(0, Math.min(maxOffset, offset + delta)));
      return;
    }
    let next =
      selected + (key.rightArrow || input === 'l' ? 1 : key.leftArrow || input === 'h' ? -1 : 0);
    if (delta && chosen) {
      const rows = [...new Set(cells.map((cell) => cell.row))];
      const targetRow = rows[rows.indexOf(chosen.row) + delta];
      const column = cells
        .filter((cell) => cell.row === chosen.row)
        .findIndex((cell) => cell.skill === chosen.skill);
      const target = cells.filter((cell) => cell.row === targetRow);
      if (target.length) next = cells.indexOf(target[Math.min(column, target.length - 1)]);
    }
    next = Math.max(0, Math.min(cells.length - 1, next));
    if (next !== selected) {
      setSelection((previous) => ({ ...previous, [scope]: next }));
      setDetailOffset(0);
    }
  });
  const scopeName = scope === 'project' ? 'Project' : 'Global';
  const header =
    [
      `Skill Shelf  /  ${scopeName}  ·  ${shelf.skills.length} installed`,
      `${scopeName} · ${shelf.skills.length} installed`,
      `${scopeName} ${shelf.skills.length}`,
    ].find((text) => stringWidth(text) <= inner) ?? scopeName;
  const visible = lines.slice(offset, offset + available);
  const footer =
    (details
      ? [
          'Esc back · ↑↓ scroll · h/l next · q quit',
          'Esc back · ↑↓ · q quit',
          'Esc · ↑↓ · q',
          'Esc · q',
        ]
      : [
          'Tab switch · arrows/hjkl · Enter details · q quit',
          'Tab · hjkl · Enter · q',
          'Tab · ↵ · q',
          '↵ · q',
        ]
    ).find((text) => stringWidth(text) <= inner) ?? 'q';
  return (
    <Box flexDirection="column" width={width} height={height} paddingX={padding}>
      <Box height={headerHeight} flexDirection="column">
        <Text bold color="#f4f5f7" wrap="truncate-end">
          {header}
        </Text>
      </Box>
      <Box flexDirection="column" height={available} overflow="hidden">
        {visible.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Stateless text rows are keyed by viewport position.
          <Text key={index} wrap="truncate-end">
            {line.length
              ? line.map((span, i) => (
                  <Text
                    // biome-ignore lint/suspicious/noArrayIndexKey: Stateless spans are keyed by position.
                    key={i}
                    color={span.color}
                    bold={span.bold}
                    dimColor={span.dim}
                    underline={span.underline}
                  >
                    {span.text}
                  </Text>
                ))
              : ' '}
          </Text>
        ))}
      </Box>
      {footerHeight > 0 && (
        <Text dimColor wrap="truncate-end">
          {footer}
        </Text>
      )}
    </Box>
  );
}
