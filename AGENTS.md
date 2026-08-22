# Agent Instructions — EVA Smart Cockpit

This public repository is the HHCC 2026 Prototype Development Track submission. The accepted product is a Vite + React + TypeScript EVA smart-cockpit prototype combining on-device DMS, an explainable L2 assistance kernel, and a three-act digital-twin demonstration.

## Competition boundary

- Work only inside this repository and only with work produced during the official hacking period.
- Do not import pre-event prototypes, research archives, temporary output, credentials, personal data, or machine-specific configuration.
- Keep submitted behavior explainable, testable, and consistent with the live demonstration.
- Use `README.md` and `docs/DECISIONS.md` as the accepted product boundary.
- The product is strictly L2 combined driving assistance. Never describe it as L3/L4 or autonomous driving; the driver remains responsible and ready to take over.

## Repository map

```text
src/core/     DOM-free simulation, EVA rules, L2 policy, and shared parameters
src/vision/   MediaPipe DMS, pure metrics, and simulated fallback signal
src/shell/    React cockpit, pausable three-act timeline, evidence, and twin stage
src/landing/  English landing page and Three.js vehicle hero
tests/        Core, vision, timeline, expression, and twin-state regression tests
public/       Self-hosted model assets; generated MediaPipe WASM is not committed
docs/         Pipeline, decisions, feature guide, provenance, and project guidance
```

## Verification

Run before each verified milestone:

```bash
npm test
npm run build
```

If `src/core/params.ts` changes, update the parameter table in `docs/PIPELINE.md` and manually run the three-act tour. The 100 ms simulation clock advances only while `running`; ready, paused, Evidence-open, and completed states must freeze. Keep the 688k-face vehicle renderer event-driven rather than restoring a permanent animation loop.

## Architecture rules

1. `src/core/` stays DOM- and React-free. UI interacts through `useCockpit()`, snapshots, and `act.*`.
2. Real and simulated DMS inputs use the same pure metrics pipeline and enter through `act.setVision()`.
3. New external resources must fail safely. Camera refusal, model failure, and WebGL failure must not block the demo.
4. Safety thresholds live only in `src/core/params.ts`.
5. User-visible UI copy remains English; team documentation and code comments may be Chinese.
6. L2 narration must retain supervision and take-over responsibility language.

## Git synchronization

- Synchronize verified milestones, not every save.
- Inspect status and diff, run relevant checks, and scan staged content for credentials or personal information before commit or push.
- Stage explicit paths only. Never use `git add -A`, `git add .`, or `git add --all`.
- Fetch before pushing; reconcile remote changes without force-pushing `main`.
- Never rewrite public history without explicit user approval.
- Report the exact state if synchronization fails or work remains uncommitted.

## Required records

- Update `README.md` when setup, launch, test, or demo behavior changes.
- Update `AI_USAGE.md` when an AI tool or purpose materially changes.
- Update `THIRD_PARTY_NOTICES.md` before adding code, models, data, fonts, or media.
- Update `docs/DECISIONS.md` when an accepted product, architecture, or workflow decision changes.
