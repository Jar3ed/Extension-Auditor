# ExtSentinel — project plan

(Working name — rename freely with a global find/replace once you pick something you like.)

## What we're building

A Manifest V3 Chrome extension that audits a user's _other_ installed extensions:
scores each one's permission risk, tracks permission and version changes over
time to catch supply-chain-style escalation (an extension quietly gaining
`<all_urls>` access after being sold or compromised), and surfaces all of it
in a popup dashboard.

## Stack

- **WXT** — a Vite-based extension framework. It generates `manifest.json`
  from your code and config instead of you hand-editing it, which removes the
  single most common two-person merge-conflict source in extension repos.
  Gives you hot reload and TypeScript by default.
- **TypeScript** everywhere. The whole plan below only works if both sides of
  the project are checked against the same type definitions.
- **React** for the popup UI (WXT ships a React template out of the box).
- **Tailwind** for styling — fast to iterate solo, nothing to fight over in a
  shared stylesheet.
- **Vitest** for unit tests on the scoring/diff logic — those are pure
  functions with no browser APIs involved, so they're trivial to test and a
  good thing to point at in a portfolio review.

## Repo layout and who owns what

```
extsentinel/
├── entrypoints/
│   ├── background.ts        # BACKEND
│   ├── popup/                # FRONTEND
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.html
│   └── options/               # FRONTEND (settings page — scan interval etc.)
├── src/
│   ├── core/                  # BACKEND — scanning, diffing, scoring
│   │   ├── scanner.ts
│   │   ├── diff.ts
│   │   ├── riskScorer.ts
│   │   └── storage.ts
│   ├── shared/                 # SHARED CONTRACT — see below
│   │   ├── types.ts
│   │   └── messages.ts
│   └── ui/                     # FRONTEND — components, hooks
│       ├── components/
│       └── hooks/
├── public/icons/
├── wxt.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

The rule of thumb: if a file lives under `src/core/` or is
`entrypoints/background.ts`, it's the backend person's. If it's under
`src/ui/`, `entrypoints/popup/`, or `entrypoints/options/`, it's the frontend
person's. Neither of you should need to open a file in the other's territory
to get your own work done.

## Why the split actually works — the message contract

The background service worker and the popup UI never call each other's
functions directly — in a Chrome extension they can't. They only ever talk
through `chrome.runtime.sendMessage` / `onMessage`. That constraint is
actually a gift here: if you agree on the _shape_ of those messages up front,
you can build your two halves in total isolation and they'll click together
at the end without either of you reading the other's code.

`src/shared/types.ts` and `src/shared/messages.ts` are that agreement. Treat
them like a real API contract:

- Defined once, together, during the bootstrap step below.
- Changed rarely, and never unilaterally — if you need a new field or message
  type mid-build, message the other person before you touch the file, since
  it affects both of you.
- The frontend person can build the entire dashboard against **mock data**
  shaped like these types before the backend logic exists at all. Don't wait
  on each other.

## Git workflow to avoid merge conflicts

1. One shared `main` branch. Treat it as the thing that should always build.
2. Each of you works on your own feature branch — `feature/backend-core`,
   `feature/frontend-ui` — and only ever touches files in your half of the
   tree (see layout above).
3. Commit small, commit often, push at least daily even if the branch isn't
   ready to merge — this keeps divergence low even though your file paths
   shouldn't overlap.
4. Use a consistent commit prefix so history stays scannable at a glance:
   `feat(core): ...`, `feat(ui): ...`, `fix(background): ...`.
5. Open a PR into `main` even though it's just the two of you — have the
   other person actually look at it. This is the cheapest way to catch
   contract drift (e.g. someone silently changed a message shape) before it
   causes a runtime bug that's annoying to trace.
6. `src/shared/**` is the one place your work genuinely overlaps. Anyone
   touching it pings the other person first, keeps the change small, and
   gets it merged fast so the other person can pull before continuing.
7. Run `npm run build` before you push, even on your own branch. Since WXT
   generates the manifest from both of your code, a break on one side can
   fail the whole build — better to catch it locally.

## Suggested sequence

1. One of you runs the **bootstrap prompt** to scaffold the repo, commits,
   and pushes to `main`.
2. The other person clones/pulls `main`.
3. Each of you branches off and runs your **role prompt** in your own Claude
   Code session, working independently.
4. Push often, open small PRs, review each other's PRs.
5. Regroup to wire the popup up against the real background messages once
   both sides are far enough along, fix any contract mismatches together.

## Milestones (rough, 3–4 weeks)

- **Week 1** — Bootstrap complete, both of you building independently against
  the mock contract. Backend: scanner + storage working. Frontend: static
  dashboard rendering mock data.
- **Week 2** — Backend: risk scorer + diff engine + real message handlers.
  Frontend: wired up to real messages, loading/error states, drill-down view.
- **Week 3** — Polish: alerting/badge count, "what changed" timeline, empty
  states, README finished, permission-justification section written.
- **Week 4** (stretch) — Optional CRX deep-scan feature, demo recording,
  writeup of the threat model and design tradeoffs for your portfolio.

## Next up

Bootstrap, both role builds, the merge, and the post-merge bug fixes
(single-flight scan guard, alarm error handling, batched storage writes,
scan-interval-to-alarm wiring) are all done and verified end to end on
`main`. Next session, split like this — both self-contained, no
`src/shared/**` coordination needed for either:

- **Frontend** — "Last scanned" feedback near the Scan button (right now
  a successful re-scan that finds nothing new looks identical to the
  button doing nothing, which caused real confusion during testing).
  Then start on permission hover-tooltips (already listed as planned in
  the README) — hovering a permission in the drill-down view explains
  what it actually lets an extension do.
- **Backend** — Toolbar badge count (`chrome.action.setBadgeText`),
  showing the number of unreviewed permission changes. Set it after a
  scan finds changes; clear it when a `GET_LATEST_SCAN` message comes in
  (i.e. whenever the popup opens) rather than adding a new message type
  for "mark as seen" — keeps this out of the shared contract entirely.
