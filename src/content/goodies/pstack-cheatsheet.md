---
title: "pstack Cheat Sheet"
description: "A quick reference for pstack, poteto's Cursor plugin. How to set it up, which command to use when, handy phrases, prompts, and ways to keep costs down."
icon: "Terminal"
href: "/goodies/pstack-cheatsheet"
date: 2026-10-17
---

[pstack](https://github.com/cursor/plugins/tree/main/pstack) is a free Cursor plugin by poteto. It gives you a set of slash commands that make Cursor's agent plan first, check its own work, and prove things work before it tells you it's done. Nothing changes until you type a command.

## Setup (once)
1. In a Cursor chat, run `/add-plugin pstack`. You can also add it from Customize in the sidebar.
2. Run `/setup-pstack`. You'll pick a reasoning budget and a model for each role. If tokens matter to you, go with a small budget. The rule only applies to **new** chats.
3. When you start real work, use `/poteto-mode` with a goal and a pass/fail check.

Tip: Option+Enter on `/poteto-mode` (or "Use as Mode") keeps it on for every turn. Plain Enter only applies it to that one message.

## Which command when

| I want to... | Use |
|---|---|
| Do something non-trivial, carefully | `/poteto-mode` |
| Make sure the agent gets it before it starts | `/in-your-own-words` |
| Aim the task higher and over-specify less | `/sharpen` |
| See how code works, or where new code should go | `/how` |
| Find out why the code looks the way it does | `/why` |
| Get a subsystem explained in plain words | `/teach` |
| Sort out types and modules before writing code | `/architect` (add "with checkpoint" if you want to review first) |
| See what a small change might break elsewhere | `/blast-radius` |
| Get other models to review a diff and try to break it | `/interrogate` |
| Fix a bug, test first | `/tdd` |
| Stop agents making the same mistakes in a repo | `/correct` |
| Give agents a scripted way to run and check the app | `/create-verification-skill` |
| Catch up on what I've been doing on a topic | `/recall` |
| Catch up on what changed in this chat | `/ketchup` |
| Hear the last reply again in plain words | `/bro` |
| Write a good README, RFC, PR description, or commit message | `/technical-writing` |
| Clean up writing that sounds like AI | `/unslop` |
| Try one brief several times and merge the best attempt | `/arena` |
| Do a big change that cuts across the codebase, properly | `/figure-it-out` |
| Turn what a session taught me into skill edits | `/reflect` |
| Lost? | `/poteto-help` |

## Handy phrases inside `/poteto-mode`
- "babysit this pr" gets a PR to merge-ready. It won't merge unless you tell it to.
- "take over this branch" picks up work someone else started.
- "pause safely" stops with things in a clean state.
- "apply prove it works, show me the real output" is for when it says it worked just because the build went green.

## Prompts to copy

If you want to learn a backend end to end:
```
/teach walk me through how a request flows through this .NET backend end to end: entry point, services, data layer, and external calls. Draw a diagram and explain it like I'm a strong frontend dev learning backend.
```

Before you approve a PR:
```
/blast-radius on this diff, then /interrogate it. List real risks only, with the file and line for each.
```

To start a feature carefully:
```
/poteto-mode add <feature>. Done when <test or behavior I can check> passes.
```

## Cost tips
- pstack uses extra tokens on subagents and review panels.
- To spend less, rerun `/setup-pstack` with a smaller budget or cheaper models, or set roles to `auto`.
- Keep `/poteto-mode` for work that really needs the rigor. For quick questions, `/how` or `/teach` is enough.

## Remember
These tools help you catch repeat mistakes earlier. You still need to review every PR yourself at work.
