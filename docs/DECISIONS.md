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

## D-004 - Defer the remote repository decision

- **Date:** 2026-08-22
- **Status:** Pending
- **Decision:** Do not create or publish a remote until the GitHub owner and visibility are explicitly confirmed.
- **Constraint:** The final submission must satisfy the organizer's public-code-repository requirement before the deadline.
