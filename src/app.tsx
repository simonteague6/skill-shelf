import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import type { Shelf } from './data.js';
import { shelfLines } from './layout.js';

export function App({ project, global }: { project: Shelf; global: Shelf }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => ({ columns: stdout.columns || 80, rows: stdout.rows || 24 }));
  const [scope, setScope] = useState<'project' | 'global'>('project');
  const [offsets, setOffsets] = useState({ project: 0, global: 0 });
  useEffect(() => {
    const resize = () => setSize({ columns: stdout.columns || 80, rows: stdout.rows || 24 });
    stdout.on('resize', resize);
    return () => { stdout.off('resize', resize); };
  }, [stdout]);
  const width = Math.max(1, size.columns);
  const height = Math.max(1, size.rows);
  const padding = width >= 20 ? 2 : 0;
  const inner = Math.max(1, width - padding * 2);
  const shelf = scope === 'project' ? project : global;
  const lines = shelfLines(shelf, scope, inner);
  const headerHeight = height >= 5 ? 2 : 1;
  const footerHeight = height >= 3 ? 1 : 0;
  const available = Math.max(0, height - headerHeight - footerHeight);
  const maxOffset = Math.max(0, lines.length - available);
  const offset = Math.min(offsets[scope], maxOffset);
  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) { exit(); return; }
    if (key.tab) { setScope(value => value === 'project' ? 'global' : 'project'); return; }
    const delta = key.downArrow || input === 'j' ? 1 : key.upArrow || input === 'k' ? -1 : 0;
    if (delta) setOffsets(previous => ({ ...previous, [scope]: Math.max(0, Math.min(maxOffset, offset + delta)) }));
  });
  const header = width >= 36 ? `Skill Shelf  /  ${scope === 'project' ? 'Project' : 'Global'}  ·  ${shelf.skills.length} installed` : `${scope === 'project' ? 'Project' : 'Global'}  ${shelf.skills.length}`;
  const visible = lines.slice(offset, offset + available);
  return <Box flexDirection="column" width={width} height={height} paddingX={padding}>
    <Box height={headerHeight} flexDirection="column"><Text bold color="#f4f5f7" wrap="truncate-end">{header}</Text></Box>
    <Box flexDirection="column" height={available} overflow="hidden">{visible.map((line, index) => <Text key={index} wrap="truncate-end">{line.length ? line.map((span, i) => <Text key={i} color={span.color} bold={span.bold} dimColor={span.dim}>{span.text}</Text>) : ' '}</Text>)}</Box>
    {footerHeight > 0 && <Text dimColor wrap="truncate-end">Tab switch  ·  q quit</Text>}
  </Box>;
}
