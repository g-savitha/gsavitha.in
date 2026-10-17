---
title: "pstack Cheat Sheet"
description: "A quick reference for pstack, poteto's Cursor plugin: setup, which command to use when, handy phrases, prompts, and cost tips."
icon: "Terminal"
href: "/goodies/pstack-cheatsheet"
date: 2026-10-17
---

[pstack](https://github.com/cursor/plugins/tree/main/pstack) is a free Cursor plugin by poteto. It's a set of slash commands that make Cursor's agent plan, check its own work, and prove things work before saying it's done. Nothing changes until you type a command.

## Setup (once)
1. In a Cursor chat: `/add-plugin pstack` (or Customize in the sidebar).
2. Run `/setup-pstack`. Pick a reasoning budget and models per role. Choose a small budget if tokens matter. The rule applies to **new** chats.
3. Start real work with `/poteto-mode` plus a goal and a pass/fail check.

Tip: Option+Enter on `/poteto-mode` (or "Use as Mode") keeps it on every turn. Plain Enter applies it to one message only.

## Which command when

| I want to... | Use |
|---|---|
| Do any non-trivial task carefully | `/poteto-mode` |
| Check the agent understood me before it starts | `/in-your-own-words` |
| Aim the task higher / less overspecified | `/sharpen` |
| Know how code works, or where new code should go | `/how` |
| Know why code is shaped this way | `/why` |
| Get a plain-language explanation of a subsystem | `/teach` |
| Settle types and module structure before coding | `/architect` (add "with checkpoint" to review first) |
| See what a small change could break elsewhere | `/blast-radius` |
| Have other models review a diff and try to break it | `/interrogate` |
| Fix a bug test-first | `/tdd` |
| Stop agents repeating the same mistakes in a repo | `/correct` |
| Give agents a scripted way to drive and verify the app | `/create-verification-skill` |
| Catch up on my recent work on a topic | `/recall` |
| Catch up on what changed in this chat | `/ketchup` |
| Hear the last reply again in plain words | `/bro` |
| Write a README, RFC, PR description, or commit message well | `/technical-writing` |
| Clean AI-sounding prose | `/unslop` |
| Several attempts at one brief, best one merged | `/arena` |
| Run a large, cross-cutting change rigorously | `/figure-it-out` |
| Turn a session's lessons into skill edits | `/reflect` |
| Lost? | `/poteto-help` |

## Handy phrases inside `/poteto-mode`
- "babysit this pr" drives a PR to merge-ready (it won't merge unless you say so)
- "take over this branch" picks up someone else's work
- "pause safely" stops in a clean state
- "apply prove it works, show me the real output" when it claims success from a green build

## Prompts to copy

Learn a backend end to end:
```
/teach walk me through how a request flows through this .NET backend end to end: entry point, services, data layer, and external calls. Draw a diagram and explain it like I'm a strong frontend dev learning backend.
```

Review a PR before approving:
```
/blast-radius on this diff, then /interrogate it. List real risks only, with the file and line for each.
```

Start a feature carefully:
```
/poteto-mode add <feature>. Done when <test or behavior I can check> passes.
```

## Cost tips
- pstack spends extra tokens on subagents and review panels.
- Rerun `/setup-pstack` with a smaller budget or cheaper models, or set roles to `auto`.
- Save `/poteto-mode` for work that needs rigor. Use `/how` or `/teach` for quick questions.

## Remember
These tools catch the repeat mistakes earlier. They don't replace your own review of every PR at work.
