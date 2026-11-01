/**
 * DOM side of the cookie-banner handling: finding banners (CMP signatures
 * first, then the semantic text scan), hiding/restoring them, deciding
 * whether one is still showing, flipping toggles in "settings" layers, and
 * the apology toast. The decisions about *what* to click live in text.ts.
 */

import {
  CMP_SIGNATURES,
  KNOWN_CONTAINER_SELECTOR,
  type CmpSignature,
} from "./cmpSignatures";
import { classifyControlText, type ControlIntent } from "./text";

export interface Control {
  el: HTMLElement;
  intent: ControlIntent;
}

export interface Banner {
  root: HTMLElement;
  controls: Control[];
  /** Set when the banner matched a known CMP signature. */
  cmpId: string | null;
}

const STYLE_ID = "extsentinel-cookie-style";
/** On <html> while waiting for a banner, so known CMPs are hidden pre-render. */
export const PREHIDE_ATTR = "data-extsentinel-prehide";
const TOAST_ID = "extsentinel-cookie-toast";

const CONTROL_SELECTOR =
  'button, [role="button"], a, input[type="button"], input[type="submit"]';
const TOGGLE_SELECTOR = 'input[type="checkbox"], [role="switch"]';
/** Bigger than this and an ancestor is a page wrapper, not a banner. */
const MAX_BANNER_TEXT = 6000;
const MAX_CLIMB = 14;
const COOKIE_WORDS =
  /cookie|gdpr|consent|datenschutz|privacidad|confidentialit|toestemming|informativa|tracking/i;
const BANNER_NAME = /cookie|consent|gdpr|cmp|privacy|banner|notice/i;

export const isDecisive = (intent: ControlIntent): boolean =>
  intent === "necessary" || intent === "reject" || intent === "accept";

// ---------------------------------------------------------------------------
// Querying (open shadow roots included — Usercentrics and others render there)
// ---------------------------------------------------------------------------

export function queryDeep(root: ParentNode, selector: string): HTMLElement[] {
  const found = new Set<HTMLElement>();
  const visit = (node: ParentNode) => {
    node.querySelectorAll<HTMLElement>(selector).forEach((el) => found.add(el));
    const hosts: Element[] = [...node.querySelectorAll("*")];
    if (node instanceof Element) hosts.push(node);
    for (const el of hosts) if (el.shadowRoot) visit(el.shadowRoot);
  };
  visit(root);
  return [...found];
}

function parentOf(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const rootNode = el.getRootNode();
  return rootNode instanceof ShadowRoot ? rootNode.host : null;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function controlLabel(el: HTMLElement): string {
  const text = el.textContent?.trim();
  if (text) return text;
  return (
    el.getAttribute("aria-label") ??
    el.getAttribute("title") ??
    (el instanceof HTMLInputElement ? el.value : "")
  );
}

/** Links that navigate away (e.g. "Reject → /cookie-policy") must not be clicked. */
function isSafeToClick(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled) return false;
  if (el instanceof HTMLAnchorElement && el.getAttribute("role") !== "button") {
    const href = el.getAttribute("href");
    return !href || href.startsWith("#") || href.startsWith("javascript:");
  }
  return true;
}

function classifiedControls(root: ParentNode): Control[] {
  const controls: Control[] = [];
  for (const el of queryDeep(root, CONTROL_SELECTOR)) {
    if (!isSafeToClick(el)) continue;
    const intent = classifyControlText(controlLabel(el));
    if (intent) controls.push({ el, intent });
  }
  return controls;
}

function signatureControls(root: HTMLElement, sig: CmpSignature): Control[] {
  const controls: Control[] = [];
  for (const [intent, list] of Object.entries(sig.controls) as [
    ControlIntent,
    string[],
  ][]) {
    for (const el of queryDeep(root, list.join(","))) {
      controls.push({ el, intent });
    }
  }
  return controls;
}

// ---------------------------------------------------------------------------
// Finding banners
// ---------------------------------------------------------------------------

function looksLikeBannerBox(el: HTMLElement): boolean {
  const position = getComputedStyle(el).position;
  if (position === "fixed" || position === "sticky") return true;
  const role = el.getAttribute("role");
  if (role === "dialog" || role === "alertdialog") return true;
  if (el.getAttribute("aria-modal") === "true") return true;
  const className = typeof el.className === "string" ? el.className : "";
  return BANNER_NAME.test(`${el.id} ${className}`);
}

/** Highest banner-looking ancestor that is still small enough to be one. */
function findBannerRoot(control: HTMLElement): HTMLElement | null {
  let best: HTMLElement | null = null;
  let node: Element | null = parentOf(control);
  for (
    let depth = 0;
    node && depth < MAX_CLIMB && node !== document.body;
    depth++, node = parentOf(node)
  ) {
    if (!(node instanceof HTMLElement)) break;
    if ((node.textContent?.length ?? 0) > MAX_BANNER_TEXT) break;
    if (node.querySelector("main, article")) break;
    if (looksLikeBannerBox(node)) best = node;
  }
  return best && COOKIE_WORDS.test(best.textContent ?? "") ? best : null;
}

export function findBanners(doc: Document): Banner[] {
  const banners: Banner[] = [];

  // One shadow-piercing walk for every known container, then match each hit
  // back to its signature (instead of one full walk per signature).
  for (const root of queryDeep(doc, KNOWN_CONTAINER_SELECTOR)) {
    const sig = CMP_SIGNATURES.find((candidate) =>
      root.matches(candidate.containers.join(",")),
    );
    if (!sig) continue;
    const bySignature = signatureControls(root, sig);
    const known = new Set(bySignature.map((c) => c.el));
    const byText = classifiedControls(root).filter((c) => !known.has(c.el));
    banners.push({
      root,
      controls: [...bySignature, ...byText],
      cmpId: sig.id,
    });
  }

  const toast = doc.getElementById(TOAST_ID);
  const semanticRoots = new Set<HTMLElement>();
  for (const { el, intent } of classifiedControls(doc)) {
    if (!isDecisive(intent) || toast?.contains(el)) continue;
    const root = findBannerRoot(el);
    if (!root) continue;
    const overlapsKnown = banners.some(
      (b) => b.root.contains(root) || root.contains(b.root),
    );
    if (!overlapsKnown) semanticRoots.add(root);
  }
  // Drop roots nested inside another candidate; keep the outermost.
  for (const root of semanticRoots) {
    const nested = [...semanticRoots].some(
      (o) => o !== root && o.contains(root),
    );
    if (nested) continue;
    banners.push({ root, controls: classifiedControls(root), cmpId: null });
  }
  return banners;
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

/**
 * Whether the element could actually be seen: connected, no display:none /
 * opacity:0 anywhere up the tree (shadow hosts included) and visible itself.
 * Computed-style based on purpose — no layout needed, so it works the same
 * in a unit-test DOM.
 */
export function isRendered(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (getComputedStyle(el).visibility === "hidden") return false;
  for (let node: Element | null = el; node; node = parentOf(node)) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.opacity === "0") return false;
  }
  return true;
}

export function ensureHideStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  // Pre-render hiding for *known* containers only (light DOM / shadow hosts).
  // Everything discovered later is hidden with inline styles instead, which
  // also works inside shadow roots where this stylesheet can't reach.
  style.textContent =
    `html[${PREHIDE_ATTR}] :is(${KNOWN_CONTAINER_SELECTOR})` +
    `{visibility:hidden!important;opacity:0!important;` +
    `pointer-events:none!important;transition:none!important;}`;
  (doc.head ?? doc.documentElement).appendChild(style);
}

export function setPrehide(doc: Document, on: boolean): void {
  if (on) doc.documentElement.setAttribute(PREHIDE_ATTR, "");
  else doc.documentElement.removeAttribute(PREHIDE_ATTR);
}

// visibility+opacity (not display:none) so layout doesn't jump and the
// banner's own scripts still see an ordinary, live element.
const HIDE_PROPS: ReadonlyArray<readonly [string, string]> = [
  ["visibility", "hidden"],
  ["opacity", "0"],
  ["pointer-events", "none"],
  ["transition", "none"],
];
const savedStyles = new WeakMap<HTMLElement, Map<string, [string, string]>>();

export function hideElement(el: HTMLElement): void {
  if (savedStyles.has(el)) return;
  const previous = new Map<string, [string, string]>();
  for (const [prop, value] of HIDE_PROPS) {
    previous.set(prop, [
      el.style.getPropertyValue(prop),
      el.style.getPropertyPriority(prop),
    ]);
    el.style.setProperty(prop, value, "important");
  }
  savedStyles.set(el, previous);
}

export function unhideElement(el: HTMLElement): void {
  const previous = savedStyles.get(el);
  if (!previous) return;
  for (const [prop, [value, priority]] of previous) {
    if (value) el.style.setProperty(prop, value, priority);
    else el.style.removeProperty(prop);
  }
  savedStyles.delete(el);
}

/** Dim full-viewport sibling overlays that belong to a hidden banner. */
function backdropsOf(root: HTMLElement): HTMLElement[] {
  const parent = parentOf(root);
  if (!parent) return [];
  return [...parent.children].filter((sibling): sibling is HTMLElement => {
    if (!(sibling instanceof HTMLElement) || sibling === root) return false;
    if ((sibling.textContent ?? "").trim() !== "") return false;
    const style = getComputedStyle(sibling);
    if (style.position !== "fixed" && style.position !== "absolute")
      return false;
    const rect = sibling.getBoundingClientRect();
    return (
      rect.width >= window.innerWidth * 0.9 &&
      rect.height >= window.innerHeight * 0.9
    );
  });
}

/** Hides a banner plus its backdrop(s); returns everything it hid. */
export function hideBanner(root: HTMLElement): HTMLElement[] {
  const hidden = [root, ...backdropsOf(root)];
  hidden.forEach(hideElement);
  return hidden;
}

export function restoreAll(doc: Document, hidden: Iterable<HTMLElement>): void {
  setPrehide(doc, false);
  for (const el of hidden) unhideElement(el);
}

/**
 * Runs `fn` with every hide marker lifted, then puts them back — all
 * synchronously, so the browser never paints the un-hidden state.
 */
export function withUnhidden<T>(
  doc: Document,
  hidden: Iterable<HTMLElement>,
  fn: () => T,
): T {
  const elements = [...hidden];
  const prehide = doc.documentElement.hasAttribute(PREHIDE_ATTR);
  setPrehide(doc, false);
  elements.forEach(unhideElement);
  try {
    return fn();
  } finally {
    if (prehide) setPrehide(doc, true);
    elements.forEach(hideElement);
  }
}

// ---------------------------------------------------------------------------
// Acting
// ---------------------------------------------------------------------------

export function clickControl(el: HTMLElement): void {
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  }
  el.click();
}

/** Sets every enabled toggle in a settings layer to match the preference. */
export function setToggles(root: HTMLElement, checked: boolean): void {
  for (const el of queryDeep(root, TOGGLE_SELECTOR)) {
    if ((el as HTMLInputElement).disabled) continue;
    if (el.getAttribute("aria-disabled") === "true") continue;
    const isOn =
      el instanceof HTMLInputElement
        ? el.checked
        : el.getAttribute("aria-checked") === "true";
    if (isOn !== checked) el.click();
  }
}

// ---------------------------------------------------------------------------
// Apology toast
// ---------------------------------------------------------------------------

export function showApology(doc: Document, actionPhrase: string): void {
  if (doc.getElementById(TOAST_ID)) return;
  const host = doc.createElement("div");
  host.id = TOAST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      .toast{position:fixed;right:16px;bottom:16px;z-index:2147483647;
        max-width:340px;padding:12px 14px;border-radius:10px;
        background:#1e293b;color:#f8fafc;font:13px/1.45 system-ui,sans-serif;
        box-shadow:0 6px 24px rgba(0,0,0,.35);display:flex;gap:10px}
      button{all:unset;cursor:pointer;color:#94a3b8;font-size:16px;line-height:1}
      button:hover{color:#fff}
    </style>
    <div class="toast" role="status">
      <span></span><button type="button" aria-label="Dismiss">×</button>
    </div>`;
  const message = shadow.querySelector("span");
  if (message) {
    message.textContent =
      `ExtSentinel tried to automatically ${actionPhrase} the cookies on this ` +
      `site but was unable to. Sorry — please choose manually.`;
  }
  shadow
    .querySelector("button")
    ?.addEventListener("click", () => host.remove());
  doc.documentElement.appendChild(host);
  setTimeout(() => host.remove(), 15000);
}
