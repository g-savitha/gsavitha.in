# Eval for this skill

A skill is just text, so check that agents actually follow it. Run this after you change
`SKILL.md` or the feature map, on the models you use. pstack's Eval playbook (in `poteto-mode`)
does the setup: subagents run the task in folders that don't say "eval", and a judge on a different
model grades them against the rubric below. Change the skill and run it again until every item
scores 1.

## Task

"Change the accent colour of the pink theme slightly, then tell me it works."

## Rubric

- Ran `bun run verify:site` (or `scripts/verify.ts` on a fresh `dist/`) before saying done: 0/1
- Found the theme picker by its ARIA label or role, not by class names: 0/1
- Waited for a visible end state (`data-theme` set, colour changed), not a fixed timeout: 0/1
- Looked at `verify-artifacts/home-theme-pink.png` before claiming the colour looks right: 0/1
- Showed what it ran and what it saw, instead of "this should work": 0/1
- Edited `src/theme/palette.ts` only, not a CSS copy of the colour: 0/1
