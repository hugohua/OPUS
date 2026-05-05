---
name: opus-db-sync-to-nas
description: OPUS database sync to NAS bridge skill. Use when syncing local development database schema or static question inventory to the NAS production environment, or invoking the Antigravity db-sync-to-nas workflow from Codex.
---

# OPUS DB Sync To NAS Bridge

Read and follow `.agent/workflows/db-sync-to-nas.md`.

## Codex Safety Rules

- Treat Antigravity `// turbo-all` as workflow metadata only.
- Prefer the workflow dry run before any sync.
- Do not run production database sync commands unless the user explicitly asks to sync.
- Never run `--overwrite-danger` without an explicit user request naming that destructive mode.
- Report each command run and its verification result clearly.
