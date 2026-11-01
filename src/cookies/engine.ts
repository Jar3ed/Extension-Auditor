/**
 * In-page orchestrator. Runs as a content script at document_start with the
 * user's preference baked in (see entrypoints/cookie-engine-*.ts), in three
 * layers:
 *
 *  1. Invisible: write known CMP consent keys before the site's scripts run,
 *     and pre-hide known banner containers so nothing flashes.
 *  2. Fallback: watch for banners (CMP signatures, then semantic text scan),
 *     keep them hidden, and click the control matching the preference.
 *  3. Last resort: if a banner is still up after the time budget, restore it
 *     and show a short apology.
 */

import {
  clickControl,
  ensureHideStyle,
  findBanners,
  hideBanner,
  isDecisive,
  isRendered,
  restoreAll,
  setPrehide,
  setToggles,
  showApology,
  unhideElement,
  withUnhidden,
  type Banner,
  type Control,
} from "./banner";
import { learnCmp, writeConsentKeys } from "./consentWriter";
import {
  COOKIE_PREFERENCE_ACTIONS,
  type CookiePreference,
} from "./preferences";
import { chooseAction } from "./text";

export interface EngineOptions {
  /** How long a banner may stay up (hidden) before we give up and apologise. */
  budgetMs: number;
  /** Give up sooner when no control can ever satisfy the preference. */
  noActionMs: number;
  /** How long after load we keep watching for banners to appear. */
  observeMs: number;
  pollMs: number;
  /** Minimum gap between clicks on the same banner. */
  actionGapMs: number;
  maxActions: number;
}

const DEFAULT_OPTIONS: EngineOptions = {
  budgetMs: 4000,
  noActionMs: 1500,
  observeMs: 15000,
  pollMs: 300,
  actionGapMs: 400,
  maxActions: 4,
};

/** Throttle for the mutation-driven scan (leading + trailing edge). */
const SCAN_THROTTLE_MS = 50;

/** crypto.randomUUID() only exists in secure contexts; plain-http pages lack it. */
function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function learn(win: Window, cmpId: string): void {
  try {
    learnCmp(win.localStorage, cmpId); // the getter itself throws when sandboxed
  } catch {
    // best-effort memory only
  }
}

interface BannerState {
  firstLiveAt: number;
  lastActionAt: number;
  actions: number;
  noActionSince: number | null;
  openedSettings: boolean;
  hidden: HTMLElement[];
}

export interface EngineHandle {
  stop(): void;
}

export function runCookieEngine(
  preference: CookiePreference,
  doc: Document = document,
  overrides: Partial<EngineOptions> = {},
): EngineHandle {
  const opts = { ...DEFAULT_OPTIONS, ...overrides };
  const win = doc.defaultView ?? window;
  const startedAt = Date.now();

  // Layer 1 — before any site script gets to read its consent state.
  try {
    writeConsentKeys(preference, win, startedAt, randomId());
  } catch {
    // cookies disabled / sandboxed frame: the DOM layers still work
  }
  ensureHideStyle(doc);
  setPrehide(doc, true);

  const states = new Map<HTMLElement, BannerState>();
  const failed = new WeakSet<HTMLElement>();
  let stopped = false;

  const allHidden = () => [...states.values()].flatMap((s) => s.hidden);

  function visibleControls(banner: Banner): Control[] {
    return banner.controls.filter((c) => isRendered(c.el));
  }

  function perform(banner: Banner, state: BannerState, now: number): void {
    const controls = visibleControls(banner);
    const action = chooseAction(preference, controls, state);

    if (!action) {
      state.noActionSince ??= now;
      return;
    }
    state.noActionSince = null;
    if (state.actions >= opts.maxActions) return;
    if (now - state.lastActionAt < opts.actionGapMs) return;

    if (action.type === "settings") state.openedSettings = true;
    if (action.type === "save") {
      setToggles(banner.root, preference === "accept_all");
    }
    clickControl(action.control.el);
    state.actions++;
    state.lastActionAt = now;
  }

  function giveUp(): void {
    for (const root of states.keys()) failed.add(root);
    restoreAll(doc, allHidden());
    states.clear();
    if (win === win.top) {
      showApology(doc, COOKIE_PREFERENCE_ACTIONS[preference]);
    }
    stop();
  }

  function tick(): void {
    if (stopped) return;
    try {
      scan();
    } finally {
      // Our own hide/unhide edits `style`, which the observer watches —
      // drop those records or every scan would trigger the next one.
      observer.takeRecords();
    }
  }

  function scan(): void {
    const now = Date.now();

    // Judge what's on screen as if nothing were hidden, all within one
    // synchronous block so the un-hidden state is never painted.
    const live = withUnhidden(doc, allHidden(), () => {
      const banners = findBanners(doc);
      for (const b of banners) if (b.cmpId) learn(win, b.cmpId);
      return banners.filter(
        (b) =>
          !failed.has(b.root) &&
          visibleControls(b).some((c) => isDecisive(c.intent)),
      );
    });

    const liveRoots = new Set(live.map((b) => b.root));

    // Banners that went away (or whose buttons are no longer visible) are
    // resolved — un-hide them so a persistent container (OneTrust keeps its
    // root forever) can still show its preference centre when the user asks.
    for (const [root, state] of states) {
      if (liveRoots.has(root)) continue;
      state.hidden.forEach(unhideElement);
      states.delete(root);
    }

    let overBudget = false;
    for (const banner of live) {
      let state = states.get(banner.root);
      if (!state) {
        state = {
          firstLiveAt: now,
          lastActionAt: 0,
          actions: 0,
          noActionSince: null,
          openedSettings: false,
          hidden: hideBanner(banner.root),
        };
        states.set(banner.root, state);
      }
      withUnhidden(doc, state.hidden, () => perform(banner, state, now));
      if (
        now - state.firstLiveAt > opts.budgetMs ||
        (state.noActionSince !== null &&
          now - state.noActionSince > opts.noActionMs)
      ) {
        overBudget = true;
      }
    }

    if (overBudget) {
      giveUp();
      return;
    }
    if (now - startedAt > opts.observeMs && states.size === 0) stop();
  }

  // Layer 2 — react to the page building itself, before paint where possible.
  let lastScan = 0;
  let trailing: ReturnType<typeof setTimeout> | undefined;
  const scheduleScan = () => {
    const sinceLast = Date.now() - lastScan;
    if (sinceLast >= SCAN_THROTTLE_MS) {
      lastScan = Date.now();
      tick();
    } else if (trailing === undefined) {
      trailing = setTimeout(() => {
        trailing = undefined;
        lastScan = Date.now();
        tick();
      }, SCAN_THROTTLE_MS - sinceLast);
    }
  };
  const observer = new MutationObserver(scheduleScan);
  observer.observe(doc, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "aria-hidden"],
  });
  const poll = setInterval(tick, opts.pollMs);
  doc.addEventListener("DOMContentLoaded", scheduleScan, { once: true });

  function stop(): void {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    clearInterval(poll);
    if (trailing !== undefined) clearTimeout(trailing);
    restoreAll(doc, allHidden());
    states.clear();
  }

  return { stop };
}
