---
name: ios-staged-workflow
description: "Use when building or changing an iOS feature and the work should be split into two phases: Superpowers first for product-goal clarification, a short spec, and an approved implementation plan with acceptance criteria; Build iOS Apps second for SwiftUI changes, App Intents when needed, and simulator-based verification with XcodeBuildMCP."
---

# iOS Staged Workflow

## Overview

Gate iOS work behind an explicit planning phase. Use Superpowers to understand the goal, define a short spec, and get plan approval before any SwiftUI or App Intents implementation. After approval, switch to Build iOS Apps for code changes and simulator verification.

## Stage 1: Frame the work with Superpowers

Before touching iOS code or XcodeBuildMCP:

- Explore the repo and any project guide first. If `.agent/skills/opus-guide/SKILL.md` exists, read it for product and architecture context.
- Use `superpowers:brainstorming` to clarify the product goal, user value, constraints, non-goals, and success criteria.
- Keep the spec short and concrete. It should usually cover:
  - goal
  - affected screens or flows
  - key technical constraints
  - non-goals
  - acceptance criteria
- Do not invoke Build iOS Apps skills during this stage.
- Get explicit user approval on the short spec before moving on.

## Stage 2: Turn the approved spec into an implementation plan

After the spec is approved:

- Use `superpowers:writing-plans` to propose the implementation plan.
- Keep the plan aligned to the approved spec. Do not add opportunistic refactors unless they are required to deliver the approved behavior.
- The plan must include:
  - files or modules likely to change
  - the chosen iOS implementation path
  - verification steps
  - explicit acceptance criteria
- Wait for the user's approval before implementation.

## Stage 3: Implement with Build iOS Apps

After plan approval, choose the narrowest Build iOS Apps skill that matches the work:

- `build-ios-apps:swiftui-view-refactor` for refactoring existing SwiftUI screens or view trees.
- `build-ios-apps:swiftui-ui-patterns` for new SwiftUI screens, navigation, state ownership, or composition decisions.
- `build-ios-apps:ios-app-intents` when the approved scope requires Shortcuts, Siri, Spotlight, widgets, controls, or other system-surface integration.
- `build-ios-apps:ios-debugger-agent` for simulator build/run, UI inspection, logs, and runtime diagnosis with XcodeBuildMCP.

Implementation rules:

- Restate the approved acceptance criteria before coding if the scope is easy to lose.
- Keep code changes inside the approved scope. If new requirements appear, pause and update the spec or plan first.
- Prefer Build iOS Apps guidance for iOS-specific architecture and tool use once implementation starts.
- If the failure mode is unclear during implementation, use `superpowers:systematic-debugging` before speculative fixes, then return to the approved plan.

## Stage 4: Verify on the simulator

Do not finish with code review alone. Verify behavior with XcodeBuildMCP.

- Use the `build-ios-apps:ios-debugger-agent` workflow to build and run on the simulator.
- Validate the approved acceptance criteria against actual simulator behavior, logs, or screenshots.
- If App Intents were added, verify the runtime handoff or system-facing behavior promised by the plan.
- Report what was verified, what was not verified, and any residual risks.

## Strong Defaults

- Plan first, implement second. Do not collapse the stages because the change looks small.
- A short approved spec beats an implicit mental model.
- App Intents should expose small useful actions, not mirror the whole app.
- Simulator evidence is required before claiming the iOS work is complete.

## Anti-Patterns

- Jumping straight into SwiftUI edits before the user approves the plan.
- Using Build iOS Apps skills to make product decisions that should have been settled in the spec.
- Expanding scope during implementation without re-approval.
- Claiming success from a build alone without checking the user-visible flow on the simulator.
