# Project plan

Status: scaffolding stage. This is a placeholder to be filled in by
whoever picks up the background/scanning role and the popup UI role —
see `README.md` for the current architecture snapshot.

## Open questions to resolve early

- Exact risk-scoring weights in `src/core/riskScorer.ts` (which
  permissions/host patterns count as high risk, and how much).
- Scan interval default and bounds (surfaced in the options page).
- Retention policy for `src/core/storage.ts` (how much history per
  extension).
- Shape of the Tier 2 "deep scan" feature and its
  `optional_host_permissions` flow.
