---
name: opus-deploy-nas
description: OPUS NAS deployment bridge skill. Use when deploying OPUS to Synology NAS, checking NAS deployment steps, or invoking the Antigravity deploy-nas workflow from Codex.
---

# OPUS NAS Deployment Bridge

Read and follow `.agent/workflows/deploy-nas.md`.

## Codex Safety Rules

- Treat Antigravity `// turbo-all` as workflow metadata only.
- Run read-only checks and local compile checks when the user asks for verification.
- Do not run production deployment commands unless the user explicitly asks to deploy.
- Before running `./build-and-export.sh latest --deploy`, confirm Docker/NAS prerequisites from the workflow are satisfied.
- Report each command run and its verification result clearly.
