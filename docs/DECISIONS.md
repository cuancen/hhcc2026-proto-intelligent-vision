# Decision Log

## D-001 - Use a separate submission repository

- **Date:** 2026-08-22
- **Status:** Accepted
- **Decision:** Keep the competition code in `hhcc-2026-prototype`, separate from the existing research workspace.
- **Reason:** The research workspace contains source material, archived explorations, temporary output, and local agent state that do not belong in a public, reviewable code submission.

## D-002 - Start with a minimal, honest bootstrap

- **Date:** 2026-08-22
- **Status:** Accepted
- **Decision:** The first repository state contains only project boundaries, compliance records, and ignore rules. It makes no product or implementation claims.
- **Reason:** The Prototype Development Track requires the submitted project to be built during the official hacking period, and reviewers must be able to distinguish completed work from plans.

## D-003 - Use `main` as the default branch

- **Date:** 2026-08-22
- **Status:** Accepted
- **Decision:** Initialize the repository on `main` and keep commits small enough to show the development timeline.

## D-004 - Publish a public remote repository

- **Date:** 2026-08-22
- **Status:** Accepted
- **Decision:** Use `https://github.com/b1207739631-rgb/hhcc-2026-prototype` as the public remote, with `main` as the default branch.
- **Reason:** This satisfies the public-code-repository requirement and provides a visible official-period development record.

## D-005 - Synchronize verified milestones, not every save

- **Date:** 2026-08-22
- **Status:** Accepted
- **Decision:** Commit and push each coherent, verified change that affects a deliverable, and always synchronize before handoff, context switch, demonstration, or final submission.
- **Reason:** The official handbook requires a public repository and documentation of official-period work, but does not require real-time push-on-save. Milestone synchronization preserves evidence without publishing secrets, broken states, or noisy micro-commits.
