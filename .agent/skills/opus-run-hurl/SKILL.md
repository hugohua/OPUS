---
name: opus-run-hurl
description: OPUS Hurl API test runner bridge skill. Use when running existing Hurl API tests, validating PRs, debugging endpoints, or invoking the Antigravity run-hurl workflow from Codex.
---

# OPUS Run Hurl Bridge

Read and follow `.agent/workflows/run-hurl.md`.

## Codex Safety Rules

- Treat Antigravity `// turbo-all` as workflow metadata only.
- Before running Hurl, confirm `hurl` is installed and `tests/hurl.env` exists when feasible.
- If the app server is not running, state that prerequisite instead of silently starting unrelated services.
- Run the narrowest requested test set first: single file, L1, L2, then all tests.
- Report the command, exit code, and failing assertions if any.
