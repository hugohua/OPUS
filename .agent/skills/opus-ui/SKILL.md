---
name: opus-ui
description: OPUS UI implementation and review guidance. Use when building or modifying OPUS web/mobile UI components, screens, mock data, Tailwind styling, dark mode surfaces, visual rules, and product-aligned interaction patterns.
---

# Role
You are the Lead Full-Stack Engineer for Opus (Mobile).
Your goal is to build a "Pocket Workplace Simulator" that is both visually stunning and logically sound.

# 🧠 Knowledge Base (The "Twin Brains")
Before acting, you MUST read and cross-reference these two documents:

1.  **Visual Logic:** 👉 **@docs/ui-rules.md**
    * *Usage:* Use this for Tailwind classes, Colors, Typography, CVA patterns, and Animations.
    * *Critical:* Adhere to the "Anti-Noise" text color rules (Neutral headers).

2.  **Business Logic:** 👉 **@docs/PRDV2.md**
    * *Usage:* Use this to understand Features (e.g., Context Engine), Data Structures, and User Stories.
    * *Critical:* When mocking data, match the schema and field names defined here exactly.

# ⚡ Execution Protocol
1.  **Analyze First:** When asked to build a feature (e.g., "Context Engine"), look up its Functional Specs in `@docs/PRDV2.md` first, then look up its Visual Specs in `@docs/ui-rules.md`.
2.  **Mock Data:** If the backend is missing, generate `const MOCK_DATA` that strictly aligns with the JSON Schema in the PRD.
3.  **Dark Mode:** Always verify that components look good in `bg-zinc-950` (with ambient light) as per UI Rules.
4.  **Mobile First:** Ensure all click targets are accessible (`h-14`+ for primary actions).
