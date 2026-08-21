# Agent Instructions

## Scope
- Work only inside this repository; do not import pre-event prototypes or files from the research workspace.
- Use `README.md` and `docs/DECISIONS.md` as the current project boundaries.
- Keep submitted behavior explainable and consistent with the demonstrated product.

## Git Synchronization
- Use milestone synchronization, not automatic push-on-save.
- After a coherent, verified change affects code, configuration, data, documentation, or demo behavior, stage explicit paths, commit, and push the current branch.
- Always synchronize before a handoff, context switch, demonstration, or final submission.
- Before commit or push, inspect status and diff, run the relevant narrow checks, and scan staged content for credentials or personal information.
- Never use `git add -A`, `git add .`, or `git add --all`; stage only the intended paths.
- Never commit or push secrets, unrelated generated files, or unverified half-complete work.
- Fetch before pushing; if the remote advanced, reconcile without force-pushing `main`.
- Never rewrite public history without explicit user approval.
- If synchronization fails or work remains uncommitted, report the exact state and reason.

## Required Records
- Update `README.md` when setup, launch, test, or demo behavior changes.
- Update `AI_USAGE.md` when an AI tool or its purpose materially changes.
- Update `THIRD_PARTY_NOTICES.md` before adding third-party code, models, data, fonts, or media.
- Update `docs/DECISIONS.md` when a product, architecture, or workflow decision is accepted or superseded.

## External References
| Need | File |
|---|---|
| Project status and workflow | `README.md` |
| Accepted decisions | `docs/DECISIONS.md` |
| AI disclosure | `AI_USAGE.md` |
| Third-party provenance | `THIRD_PARTY_NOTICES.md` |
