# Compatibility and safety

## Destination snapshot

Skill Shelf scans the installation destinations in the checked-in `src/registry.ts`, attributed to [vercel-labs/skills `src/agents.ts`](https://github.com/vercel-labs/skills/blob/1a1d387ed4286e59aa43a2696cf02b3590061c91/src/agents.ts), revision `1a1d387ed4286e59aa43a2696cf02b3590061c91`, checked 2026-11-04. All 79 agent records are represented, including project-only Eve and PromptScript. Shared physical destinations are scanned once and labeled Agents for `.agents/skills`; they do not imply agent installation or activation. Agent-detection predicates and source-repository discovery rules are not installation destinations.

Global config destinations use absolute `XDG_CONFIG_HOME` or `~/.config` where upstream uses XDG config. The global lock path uses `XDG_STATE_HOME` verbatim, including relative values, matching upstream `src/skill-lock.ts`. Crush and Kimchi use the literal home-relative `.config` paths in the pinned registry. Whitespace-only agent-home overrides fall back to upstream defaults. `CODEX_HOME`, `SARVAM_HOME`, `APPDATA` for Zed and `FLATPAK_XDG_CONFIG_HOME` affect upstream detection, not their skill destinations. On Windows, Reasonix defaults to `$APPDATA/reasonix/skills` (or `~/AppData/Roaming/reasonix/skills`); `REASONIX_HOME` overrides that path. OpenClaw selects its first existing recognized home directory. No registry lookup or other network request occurs at startup.

Project boundaries use resolved physical launch/home paths, so a launch-directory symlink into home cannot mix Global into Project. Supported skill-folder symlinks can point outside the containing directory: their observed installation path is retained. Inventory is read-only and loaded once; it is not an atomic filesystem transaction. Restart to observe changes.

## Complete-copy comparison

Resolved installation-folder aliases collapse before separate-copy equality is considered, and their target information is reused. Separate copies require matching complete relative directory/file sets and streamed SHA-256 content fingerprints. Binary files are included, text is not normalized, and empty directories participate. Ownership, permissions, timestamps and hard-link identity do not define content equality. Metadata checks detect files or directories changing during a comparison; uncertainty keeps the entries separate.

Concrete limits:

- **Per folder:** 32 MiB of regular-file content, 2,048 entries including the root and directories, and maximum relative depth 32 (root is depth 0).
- **Per startup:** 256 MiB of considered regular-file content and 16,384 visited entries across Project ancestors and Global combined. Direct `loadShelf` calls use the same aggregate limits for that collection.
- **Memory:** content is read in 64 KiB buffers. Comparison directory listings are bounded by the entry limits; whole skill folders are not buffered.
- **Metadata:** lock files must be regular readable files of at most 4 MiB; only project v1 and global v3 schemas are supported.

Work proceeds in a fixed destination order with sorted immediate skill names and sorted relative comparison paths. Exceeded limits, inaccessible data, changed entries, internal symlinks (including cycles), and unsupported filesystem entries leave equality unproven. Copies remain visible with a summarized notice; resolved aliases can still collapse. Internal symlinks are not followed, even when their targets might be equal. These budgets bound content work and memory, not filesystem-operation latency: an unresponsive filesystem can still delay startup. There is no persistent equality cache.

Missing optional destinations and missing locks do not generate overview noise. Permission/read failures, malformed or unsupported metadata and unproven comparisons are summarized by directory/collection without hiding successfully inventoried skills. Untrusted filenames, paths and metadata are stripped of terminal controls and directional override characters before display.
