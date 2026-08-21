# HHCC 2026 Repository Bootstrap Design

- **Date:** 2026-08-22
- **Status:** Approved for repository initialization
- **Scope:** Repository boundary and compliance scaffolding only; no product implementation

## Context

The team needs a reviewable code repository for the HHCC 2026 Prototype Development Track. The existing `哈佛创客马拉松` workspace is a research collection with official materials, active notes, archives, temporary output, and local agent state. Publishing it would mix evidence, drafts, and implementation while increasing the risk of leaking irrelevant or sensitive files.

## Approaches considered

1. **Reuse the research workspace Git repository.** Fastest, but unsafe and hard to review because every current item is untracked and the directory contains non-submission material.
2. **Create a nested repository inside the research workspace.** Keeps paths nearby, but creates confusing nested Git boundaries and makes accidental staging more likely.
3. **Create a clean sibling repository.** Adds one directory but gives the clearest submission boundary, safest ignore rules, and most legible official-period history.

## Decision

Use the sibling repository `C:\Users\26940\Documents\hhcc-2026-prototype` with `main` as its default branch. The research workspace remains unchanged and is not a source tree for the submission.

## Bootstrap contents

- `README.md` states the current status, competition constraints, and future operating instructions.
- `.gitignore` blocks secrets, dependencies, generated output, editor files, and local agent state.
- `AI_USAGE.md` records actual AI assistance and team review.
- `THIRD_PARTY_NOTICES.md` establishes provenance requirements before dependencies or assets are added.
- `docs/DECISIONS.md` records the repository decision and future material choices.

No application code, copied prototype, model weight, dataset, or media asset is included in this phase.

## Repository workflow

1. Review and approve a product design before implementation.
2. Add source and tests in small, explainable commits made during the official hacking period.
3. Update README commands, decisions, AI usage, and third-party notices alongside the changes they describe.
4. Run repository-specific tests and a sensitive-file scan before every release or submission.
5. Create the public remote only after confirming the GitHub owner and visibility, then verify every submission link before the deadline.

## Verification

The bootstrap is acceptable when:

- the repository root is the new sibling path;
- the branch is `main`;
- the research workspace is not copied or tracked;
- only the documented bootstrap files are staged or committed;
- ignored secret patterns behave as expected;
- no remote exists until explicitly configured;
- the working tree state is reported accurately.

## Open items before implementation

- Confirm the final product direction and success criteria.
- Confirm the implementation stack and test commands.
- Configure an accurate Git author identity for the first commit.
- Confirm the GitHub owner and required repository visibility.
