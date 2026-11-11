---
name: sdd-help
description: Explain what each Spec Kit (speckit-*) skill does and when to call it, then inspect the current branch and spec folder to suggest the next command. Use when the user asks for speckit help, which speckit command to run, or what's next in the spec-driven workflow.
---

# Spec Kit help

Read-only: this skill never edits files, creates branches or runs other skills. It explains and recommends.

## 1. Show the reference

Print this table (translate the prose, not the command names, if the user writes in Spanish).

**Step 0, before any skill:** create the feature branch from `main` with `git switch -c feat/<name>`. Spec Kit does not create branches.

| Order | Command                 | What it does                                                                                                 | When to call it                                                                            | Writes                                                                            | Required |
| ----- | ----------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------- |
| 1     | `/speckit-specify`      | Turns a plain description of _what and why_ into user stories and acceptance criteria, with no tech details. | Starting a feature, or reshaping its scope.                                                | `specs/NNN-<name>/spec.md`, `checklists/requirements.md`, `.specify/feature.json` | Yes      |
| 2     | `/speckit-clarify`      | Asks up to 5 targeted questions about gaps and writes the answers back into the spec.                        | The spec has `[NEEDS CLARIFICATION]` markers or anything is ambiguous.                     | `spec.md` (`## Clarifications`)                                                   | Optional |
| 3     | `/speckit-plan`         | Designs the technical approach, gated by the Constitution Check.                                             | The spec is stable.                                                                        | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`          | Yes      |
| 4     | `/speckit-tasks`        | Breaks the plan into dependency-ordered, checkable tasks.                                                    | The plan is done.                                                                          | `tasks.md`                                                                        | Yes      |
| 5     | `/speckit-analyze`      | Cross-checks spec, plan and tasks for gaps, contradictions and constitution violations, without editing.     | After tasks, before implementing, to catch drift early.                                    | Nothing (report only)                                                             | Optional |
| any   | `/speckit-checklist`    | Generates a custom quality checklist for a domain (security, UX, API…) that tests the requirements.          | You want a focused review of the spec's quality in one area.                               | `checklists/<domain>.md`                                                          | Optional |
| 6     | `/speckit-implement`    | Works through `tasks.md`, ticking tasks off as it builds them.                                               | Tasks exist and are reviewed.                                                              | Code, tests, `tasks.md` checkboxes                                                | Yes      |
| 7     | `/speckit-converge`     | Compares the code with spec, plan and tasks, and appends any unbuilt work as new tasks.                      | After implement; repeat implement → converge until it reports converged, then open the PR. | `tasks.md` (new tasks)                                                            | Yes      |
| —     | `/speckit-constitution` | Amends the project constitution with a semver bump.                                                          | Changing a non-negotiable rule, always in its own PR, never inside a feature.              | `.specify/memory/constitution.md`                                                 | Rare     |
| —     | `/sdd-help`             | This guide plus a next-step suggestion.                                                                      | Whenever you're unsure what to run.                                                        | Nothing                                                                           | —        |

## 2. Work out where we are

Gather, read-only:

1. Current branch: `git branch --show-current`.
2. Active feature: `feature_directory` in `.specify/feature.json` (may be missing).
3. In that directory: which of `spec.md`, `plan.md`, `tasks.md` exist.
4. In `spec.md`: any `[NEEDS CLARIFICATION` markers, and whether a `## Clarifications` section exists.
5. In `tasks.md`: count open (`- [ ]`) and done (`- [x]` or `- [X]`) tasks.

## 3. Recommend the next command

Apply the first matching rule:

| State                                        | Recommend                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| On `main` and about to start something new   | Create a branch (`git switch -c feat/<name>`), then `/speckit-specify <what and why>`.                               |
| No feature directory, or no `spec.md`        | `/speckit-specify <what and why>`.                                                                                   |
| `spec.md` has `[NEEDS CLARIFICATION` markers | `/speckit-clarify`.                                                                                                  |
| No `plan.md`                                 | `/speckit-plan` (suggest `/speckit-clarify` first if there is no `## Clarifications` section and scope feels loose). |
| No `tasks.md`                                | `/speckit-tasks`, then optionally `/speckit-analyze`.                                                                |
| Open tasks remain                            | `/speckit-implement` (mention how many are open).                                                                    |
| All tasks done                               | `/speckit-converge`; if it already reported converged, run format, lint, typecheck and tests, then open the PR.      |

Also warn when:

- the branch is `main` but there is unfinished work in the active feature, or
- the branch name doesn't match the feature directory (for example `feat/chores` vs `specs/002-expenses`), since `feature.json` may point at an older feature.

Answer briefly: the table (unless the user only asked "what's next"), the detected state in one or two lines, and the recommended command with one sentence of why.
