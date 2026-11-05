import { access } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

// Installation destinations from vercel-labs/skills src/agents.ts at
// 1a1d387ed4286e59aa43a2696cf02b3590061c91 (2026-11-04).
// Detection predicates are intentionally not used: this is an observational inventory.
export const registry = [
  ['AiderDesk', '.aider-desk/skills', '.aider-desk/skills'],
  ['Amp', '.agents/skills', '$config/agents/skills'],
  ['Antigravity', '.agents/skills', '.gemini/antigravity/skills'],
  ['Antigravity CLI', '.agents/skills', '.gemini/antigravity-cli/skills'],
  ['AstrBot', 'data/skills', '.astrbot/data/skills'],
  ['Autohand Code CLI', '.autohand/skills', '$AUTOHAND_HOME/skills'],
  ['Augment', '.augment/skills', '.augment/skills'],
  ['IBM Bob', '.bob/skills', '.bob/skills'],
  ['Claude Code', '.claude/skills', '$CLAUDE_CONFIG_DIR/skills'],
  ['OpenClaw', 'skills', '$openclaw/skills'],
  ['Cline', '.agents/skills', '.agents/skills'],
  ['CodeArts Agent', '.codeartsdoer/skills', '.codeartsdoer/skills'],
  ['CodeBuddy', '.codebuddy/skills', '.codebuddy/skills'],
  ['Codemaker', '.codemaker/skills', '.codemaker/skills'],
  ['CodeStudio', '.codestudio/skills', '.codestudio/skills'],
  ['Codex', '.agents/skills', '.agents/skills'],
  ['Command Code', '.commandcode/skills', '.commandcode/skills'],
  ['Continue', '.continue/skills', '.continue/skills'],
  ['Cortex Code', '.cortex/skills', '.snowflake/cortex/skills'],
  ['Crush', '.crush/skills', '.config/crush/skills'],
  ['Cursor', '.agents/skills', '.cursor/skills'],
  ['Deep Agents', '.agents/skills', '.deepagents/agent/skills'],
  ['Devin for Terminal', '.devin/skills', '$config/devin/skills'],
  ['Dexto', '.agents/skills', '.agents/skills'],
  ['Droid', '.agents/skills', '.factory/skills'],
  ['Eve', 'agent/skills', undefined],
  ['Firebender', '.agents/skills', '.firebender/skills'],
  ['ForgeCode', '.forge/skills', '.forge/skills'],
  ['fx', '.agents/skills', '.agents/skills'],
  ['Gemini CLI', '.agents/skills', '.gemini/skills'],
  ['GitHub Copilot', '.agents/skills', '.copilot/skills'],
  ['Goose', '.goose/skills', '$config/goose/skills'],
  ['Grok Build', '.grok/skills', '$GROK_HOME/skills'],
  ['Hermes Agent', '.hermes/skills', '$HERMES_HOME/skills'],
  ['inference.sh', '.inferencesh/skills', '.inferencesh/skills'],
  ['Jazz', '.jazz/skills', '.jazz/skills'],
  ['Junie', '.junie/skills', '.junie/skills'],
  ['iFlow CLI', '.iflow/skills', '.iflow/skills'],
  ['Kilo Code', '.agents/skills', '.kilo/skills'],
  ['Kimchi', '.kimchi/skills', '.config/kimchi/harness/skills'],
  ['Kimi Code CLI', '.agents/skills', '.agents/skills'],
  ['Kiro CLI', '.kiro/skills', '.kiro/skills'],
  ['Kode', '.kode/skills', '.kode/skills'],
  ['Lingma', '.lingma/skills', '.lingma/skills'],
  ['Loaf', '.agents/skills', '.agents/skills'],
  ['MCPJam', '.mcpjam/skills', '.mcpjam/skills'],
  ['MiniMax Code', '.minimax/skills', '.minimax/skills'],
  ['Mistral Vibe', '.vibe/skills', '$VIBE_HOME/skills'],
  ['Moxby', '.moxby/skills', '.moxby/skills'],
  ['Mux', '.mux/skills', '.mux/skills'],
  ['OpenCode', '.agents/skills', '$config/opencode/skills'],
  ['OpenHands', '.openhands/skills', '.openhands/skills'],
  ['Ona', '.ona/skills', '.ona/skills'],
  ['Pi', '.agents/skills', '.agents/skills'],
  ['Posit Assistant', '.posit/assistant/skills', '.posit/assistant/skills'],
  ['Qoder', '.qoder/skills', '.qoder/skills'],
  ['Qoder CN', '.qoder/skills', '.qoder-cn/skills'],
  ['Qwen Code', '.qwen/skills', '.qwen/skills'],
  ['Replit', '.agents/skills', '$config/agents/skills'],
  ['Reasonix', '.reasonix/skills', '$REASONIX_HOME/skills'],
  ['Rovo Dev', '.rovodev/skills', '.rovodev/skills'],
  ['Roo Code', '.roo/skills', '.roo/skills'],
  ['Sarvam Code', '.agents/skills', '.agents/skills'],
  ['Tabnine CLI', '.tabnine/agent/skills', '.tabnine/agent/skills'],
  ['Terramind', '.terramind/skills', '.terramind/skills'],
  ['Tinycloud', '.tinycloud/skills', '.tinycloud/skills'],
  ['Trae', '.trae/skills', '.trae/skills'],
  ['Trae CN', '.trae/skills', '.trae-cn/skills'],
  ['Warp', '.agents/skills', '.agents/skills'],
  ['Windsurf', '.windsurf/skills', '.codeium/windsurf/skills'],
  ['Zed', '.agents/skills', '.agents/skills'],
  ['ZCode', '.zcode/skills', '.zcode/skills'],
  ['Zencoder', '.zencoder/skills', '.zencoder/skills'],
  ['Zenflow', '.zencoder/skills', '.zencoder/skills'],
  ['Neovate', '.neovate/skills', '.neovate/skills'],
  ['Pochi', '.pochi/skills', '.pochi/skills'],
  ['PromptScript', '.agents/skills', undefined],
  ['AdaL', '.adal/skills', '.adal/skills'],
  ['Universal', '.agents/skills', '$config/agents/skills'],
] as const;

export async function destinations(
  base: string,
  scope: 'project' | 'global',
  env: NodeJS.ProcessEnv,
) {
  const roots: Record<string, string> = {
    config:
      env.XDG_CONFIG_HOME && isAbsolute(env.XDG_CONFIG_HOME)
        ? env.XDG_CONFIG_HOME
        : join(base, '.config'),
    AUTOHAND_HOME: env.AUTOHAND_HOME?.trim() || join(base, '.autohand'),
    CLAUDE_CONFIG_DIR: env.CLAUDE_CONFIG_DIR?.trim() || join(base, '.claude'),
    GROK_HOME: env.GROK_HOME?.trim() || join(base, '.grok'),
    HERMES_HOME: env.HERMES_HOME?.trim() || join(base, '.hermes'),
    VIBE_HOME: env.VIBE_HOME?.trim() || join(base, '.vibe'),
    REASONIX_HOME:
      env.REASONIX_HOME?.trim() ||
      (process.platform === 'win32'
        ? join(env.APPDATA?.trim() || join(base, 'AppData/Roaming'), 'reasonix')
        : join(base, '.reasonix')),
    openclaw: join(base, '.openclaw'),
  };
  if (scope === 'global')
    for (const folder of ['.openclaw', '.clawdbot', '.moltbot']) {
      try {
        await access(join(base, folder));
        roots.openclaw = join(base, folder);
        break;
      } catch {
        /* Optional legacy destination. */
      }
    }
  const paths = new Map<string, string>();
  paths.set(join(base, '.agents/skills'), 'Agents');
  for (const [label, project, global] of registry) {
    const spec = scope === 'project' ? project : global;
    if (!spec) continue;
    const [token, ...rest] = spec.split('/');
    const path = spec.startsWith('$') ? join(roots[token.slice(1)], ...rest) : join(base, spec);
    if (!paths.has(path)) paths.set(path, label);
  }
  return [...paths].map(([path, label]) => ({ path, label }));
}
