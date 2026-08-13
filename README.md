# ExtSentinel

A Manifest V3 Chrome extension that audits your other installed
extensions: scores their permission risk and flags when an extension's
permissions escalate on update.

## Why this exists

[CRXcavator](https://crxcavator.io/) — one of the few free tools that
scored Chrome extension risk — shut down in 2023. Since then there's been
no free, always-on way for everyday users to keep an eye on what their
installed extensions can actually do, or to notice when an extension
quietly grants itself broader access after an update. That's a real
supply-chain attack pattern: extensions get sold or compromised, and the
new owner ships an update that adds permissions nobody re-reviews.
ExtSentinel watches for that.

## Features

- Enumerate installed extensions and score each one's permission risk
  (low / medium / high / critical)
- Detect permission escalation between scans (e.g. after an
  auto-update) and surface it as an alert
- Popup dashboard showing current risk across all installed extensions
- Configurable scan interval (options page)
- _Planned:_ opt-in deep scan of an extension's source/bundle for a more
  thorough risk assessment
- _Planned:_ scan history per extension
- _Planned:_ hover tooltips on individual permissions in the drill-down
  view explaining what that permission actually lets an extension do

## Tech stack

- [WXT](https://wxt.dev/) (Vite-based web extension framework)
- React + TypeScript
- Tailwind CSS
- Vitest
- ESLint + Prettier

## Getting started

```bash
npm install
npm run dev
```

This builds the extension into `.output/chrome-mv3-dev` and watches for
changes.

To load it in Chrome for local testing:

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3-dev` directory produced by `npm run dev`

Other useful scripts:

```bash
npm run build        # production build
npm run compile      # TypeScript type-check, no emit
npm run lint         # ESLint
npm run format       # Prettier, writes changes
npm run test         # Vitest
```

## Permissions justification

| Permission   | Why we need it                                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `management` | Read the list of installed extensions and their permissions/version, via `chrome.management`. This is the core data source for scanning — without it we can't see what's installed. |
| `storage`    | Persist scan results and per-extension history locally (`chrome.storage.local`), so we can diff the current scan against the previous one to detect permission escalation.          |
| `alarms`     | Run scans on a recurring interval in the background service worker, instead of only when the popup is opened.                                                                       |

We deliberately do **not** request `host_permissions` at install time.
A future opt-in "deep scan" feature (Tier 2) will request host access
via `optional_host_permissions`, granted per-site and per-user at the
moment it's actually needed — not bundled into the base install.

## Architecture overview

See [PROJECT-PLAN.md](./PROJECT-PLAN.md) for the fuller design writeup.
At a glance:

- `entrypoints/background.ts` — service worker; owns the scan alarm and
  the runtime message handler
- `entrypoints/popup/` — dashboard UI
- `entrypoints/options/` — settings (scan interval, etc.)
- `src/core/` — scanning, diffing, and risk-scoring logic (framework-
  agnostic, unit-testable)
- `src/shared/` — types and message contracts shared between background
  and UI
- `src/ui/` — shared React components/hooks used by popup and options

## Contributing / branch workflow

- Work in feature branches, open a PR even for a two-person team — it
  keeps a review checkpoint on anything touching extension permissions.
- `src/shared/**` (the type and message contracts) is the boundary
  between the background/scanning work and the UI work. Changes there
  affect both of us — coordinate before editing rather than resolving it
  in review.
- Keep `src/core/**` logic framework-agnostic and covered by Vitest
  where practical.

## Limitations / threat model

- **This is a heuristic risk score, not a malware verdict.** A high
  score means "this extension can do a lot," not "this extension is
  malicious." A low score doesn't guarantee safety.
- By default, ExtSentinel cannot read the source code of your installed
  extensions — it only sees what `chrome.management` exposes (name,
  version, permissions, install type, etc.). Inspecting actual extension
  code is a planned, explicit opt-in "deep scan" feature, not something
  that happens automatically.
- Escalation detection is only as good as the scan interval — an
  extension that updates and reverts permissions between two scans could
  be missed.
- ExtSentinel does not modify, disable, or remove other extensions. It
  reports; you decide.

## License

MIT
