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
- **Status:** Superseded by D-011
- **Decision:** Initially use `https://github.com/b1207739631-rgb/hhcc-2026-prototype` as the milestone remote, with `main` as the default branch.
- **Reason:** This created a reviewable official-period development record before the designated competition repository became writable.

## D-005 - Synchronize verified milestones, not every save

- **Date:** 2026-08-22
- **Status:** Accepted
- **Decision:** Commit and push each coherent, verified change that affects a deliverable, and always synchronize before handoff, context switch, demonstration, or final submission.
- **Reason:** The official handbook requires a public repository and documentation of official-period work, but does not require real-time push-on-save. Milestone synchronization preserves evidence without publishing secrets, broken states, or noisy micro-commits.

## D-006 - Build an explainable EVA smart-cockpit prototype

- **Date:** 2026-08-22
- **Status:** Accepted
- **Decision:** Build EVA as an in-cabin perception and action agent combining browser-local DMS, workload fatigue, cabin controls, and L2 assistance. Demonstrate the product through City Commute, Fatigue Guard, and Complex Roads.
- **Reason:** The team selected a human-protection theme that goes beyond a single fatigue detector while remaining demonstrable, explainable, and aligned with the prototype track.

## D-007 - Use a DOM-free kernel and browser-local perception

- **Date:** 2026-08-22
- **Status:** Accepted
- **Decision:** Keep simulation and safety rules independent of React and the DOM; process live camera input locally with MediaPipe and provide an explicit simulated fallback through the same metrics pipeline.
- **Reason:** This supports deterministic tests, privacy, graceful degradation, and a clear boundary between real DMS evidence and simulated driving conditions.

## D-008 - Preserve official-period implementation history

- **Date:** 2026-08-22
- **Status:** Accepted
- **Decision:** Merge the verified implementation history created on 2026-08-22 into this public competition repository rather than flattening the source into a single bulk commit.
- **Reason:** The source commits were produced during the official development period. Preserving them provides an honest progression from scaffold, kernel, DMS, and accessibility through the landing experience and digital-twin checkpoint. Pre-event research archives and generated local output remain excluded.

## D-009 - Present the three scenarios through one digital-twin stage

- **Date:** 2026-08-22
- **Status:** Accepted
- **Decision:** Retain one full-screen vehicle digital-twin interface with a pausable three-act tour and a separate technical Evidence surface. All public UI copy is English, and all assistance remains explicitly L2.
- **Reason:** The team rejected the earlier monitoring-wall layout and the object-memory story because they diluted the three-scenario product narrative. A single stage communicates the experience while Evidence preserves inspectability.

## D-010 - Upgrade the public-repository development toolchain

- **Date:** 2026-08-22
- **Status:** Accepted
- **Decision:** Upgrade Vite to 8.2.2, the React plugin to 6.1.0, and Vitest to 4.1.11 before publishing the runnable checkpoint; require Node.js 20.19+ or 22.12+.
- **Reason:** The imported lockfile reported five known development-server and test-runner vulnerabilities, including one critical advisory. The upgraded toolchain removes the audit findings while keeping the application and regression suite unchanged.

## D-011 - Designate the official public competition repository

- **Date:** 2026-08-22
- **Status:** Accepted
- **Decision:** Use `https://github.com/cuancen/hhcc2026-proto-intelligent-vision` as the official public competition repository. Retain `https://github.com/b1207739631-rgb/hhcc-2026-prototype` as the team staging mirror and synchronize only verified milestones to both `main` branches.
- **Reason:** The team confirmed that the `cuancen` repository is the public submission target. Keeping the staging mirror preserves the verified handoff while the public repository remains the authoritative URL for judges.
