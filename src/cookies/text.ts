/**
 * Semantic button classification: given the visible label of a control inside
 * a consent banner, decide what it does. Pure and DOM-free so it's unit
 * testable, and so the fallback works on home-made banners no CMP signature
 * recognises.
 *
 * Phrases are stored normalised (lowercase, diacritics stripped, punctuation
 * removed) and matched as an ordered token subsequence with small gaps, so
 * "Only the necessary cookies" still matches "only necessary".
 */

import type { CookiePreference } from "./preferences";

export type ControlIntent =
  "necessary" | "reject" | "accept" | "save" | "settings";

/** Longer labels are paragraphs/links, not buttons — never classify them. */
const MAX_LABEL_TOKENS = 8;
/** Max tokens allowed between consecutive phrase tokens. */
const MAX_GAP = 2;

export function normalizeLabel(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

const NECESSARY = [
  // en
  "only necessary",
  "necessary only",
  "only essential",
  "essential only",
  "only required",
  "required only",
  "necessary cookies only",
  "essential cookies only",
  "accept necessary",
  "accept essential",
  "accept required",
  "allow necessary",
  "allow essential",
  // de
  "nur notwendige",
  "nur erforderliche",
  "nur essenzielle",
  "nur essentielle",
  "nur technisch notwendige",
  // fr
  "uniquement necessaires",
  "seulement necessaires",
  "uniquement essentiels",
  "essentiels uniquement",
  "necessaires uniquement",
  // es
  "solo necesarias",
  "solo esenciales",
  "solo imprescindibles",
  "unicamente necesarias",
  // it
  "solo necessari",
  "solo essenziali",
  "solo tecnici",
  // nl
  "alleen noodzakelijke",
  "alleen functionele",
  "alleen essentiele",
  "enkel noodzakelijke",
  // pt
  "apenas necessarios",
  "somente necessarios",
  "so necessarios",
  "apenas essenciais",
];

const REJECT = [
  // en
  "reject all",
  "reject",
  "decline all",
  "decline",
  "deny all",
  "deny",
  "refuse all",
  "refuse",
  "disagree",
  "do not accept",
  "dont accept",
  "do not agree",
  "no thanks",
  "no thank you",
  "continue without accepting",
  "continue without agreeing",
  "opt out",
  "reject non essential",
  "reject optional",
  "decline optional",
  // de
  "alle ablehnen",
  "alles ablehnen",
  "ablehnen",
  "verweigern",
  "nicht zustimmen",
  "nein danke",
  // fr
  "tout refuser",
  "refuser tout",
  "refuser",
  "continuer sans accepter",
  "non merci",
  "je refuse",
  // es
  "rechazar todo",
  "rechazar todas",
  "rechazar",
  "denegar",
  "continuar sin aceptar",
  "no aceptar",
  "no gracias",
  // it
  "rifiuta tutto",
  "rifiuta tutti",
  "rifiuta",
  "rifiutare",
  "continua senza accettare",
  "no grazie",
  // nl
  "alles weigeren",
  "alle weigeren",
  "weigeren",
  "alles afwijzen",
  "afwijzen",
  "nee bedankt",
  // pt
  "rejeitar tudo",
  "rejeitar todos",
  "rejeitar",
  "recusar tudo",
  "recusar",
  "continuar sem aceitar",
  "nao aceitar",
  "nao obrigado",
];

const SAVE = [
  "save settings",
  "save preferences",
  "save and close",
  "save my choices",
  "save choices",
  "confirm my choices",
  "confirm choices",
  "confirm selection",
  "allow selection",
  "save",
  "auswahl speichern",
  "auswahl bestatigen",
  "speichern",
  "enregistrer",
  "valider mes choix",
  "confirmer mes choix",
  "guardar preferencias",
  "confirmar seleccion",
  "guardar",
  "salva preferenze",
  "salva",
  "conferma",
  "opslaan",
  "bevestig",
  "salvar",
  "confirmar",
];

const ACCEPT = [
  // en
  "accept all",
  "accept",
  "allow all",
  "allow",
  "agree",
  "i agree",
  "accept cookies",
  "allow cookies",
  "agree and continue",
  "agree and close",
  "accept and close",
  "ok",
  "okay",
  "got it",
  "i understand",
  "consent",
  // de
  "alle akzeptieren",
  "alles akzeptieren",
  "akzeptieren",
  "alle zulassen",
  "zulassen",
  "zustimmen",
  "einverstanden",
  "ich stimme zu",
  // fr
  "tout accepter",
  "accepter tout",
  "accepter",
  "accepte",
  "autoriser tout",
  "autoriser",
  // es
  "aceptar todo",
  "aceptar todas",
  "aceptar",
  "acepto",
  "permitir todo",
  "permitir todas",
  "estoy de acuerdo",
  // it
  "accetta tutto",
  "accetta tutti",
  "accetta",
  "accettare",
  "accetto",
  "consenti tutti",
  "consenti",
  // nl
  "alles accepteren",
  "accepteren",
  "akkoord",
  "alles toestaan",
  "toestaan",
  "ik ga akkoord",
  // pt
  "aceitar tudo",
  "aceitar todos",
  "aceitar",
  "aceito",
  "permitir todos",
  "concordo",
];

const SETTINGS = [
  "settings",
  "manage",
  "manage preferences",
  "manage cookies",
  "cookie settings",
  "customize",
  "customise",
  "preferences",
  "more options",
  "options",
  "einstellungen",
  "verwalten",
  "anpassen",
  "parametres",
  "personnaliser",
  "gerer",
  "configuracion",
  "personalizar",
  "gestionar",
  "impostazioni",
  "personalizza",
  "gestisci",
  "instellingen",
  "aanpassen",
  "beheren",
  "configuracoes",
  "gerir",
];

/** Order matters: "accept only necessary" must hit NECESSARY before ACCEPT. */
const INTENT_PHRASES: ReadonlyArray<
  readonly [ControlIntent, ReadonlyArray<readonly string[]>]
> = (
  [
    ["necessary", NECESSARY],
    ["reject", REJECT],
    ["save", SAVE],
    ["accept", ACCEPT],
    ["settings", SETTINGS],
  ] as const
).map(([intent, phrases]) => [
  intent,
  phrases.map((phrase) => phrase.split(" ")),
]);

function containsPhrase(tokens: string[], phrase: readonly string[]): boolean {
  for (let start = 0; start < tokens.length; start++) {
    if (tokens[start] !== phrase[0]) continue;
    let at = start;
    let matched = true;
    for (let k = 1; k < phrase.length && matched; k++) {
      let found = -1;
      for (let g = 1; g <= MAX_GAP + 1 && at + g < tokens.length; g++) {
        if (tokens[at + g] === phrase[k]) {
          found = at + g;
          break;
        }
      }
      if (found === -1) matched = false;
      else at = found;
    }
    if (matched) return true;
  }
  return false;
}

export function classifyControlText(text: string): ControlIntent | null {
  const tokens = normalizeLabel(text);
  if (tokens.length === 0 || tokens.length > MAX_LABEL_TOKENS) return null;
  for (const [intent, phrases] of INTENT_PHRASES) {
    if (phrases.some((phrase) => containsPhrase(tokens, phrase))) {
      return intent;
    }
  }
  return null;
}

/** Which intents satisfy a preference, best first. */
export const INTENT_ORDER: Record<CookiePreference, ControlIntent[]> = {
  deny_all: ["reject", "necessary"],
  necessary_only: ["necessary", "reject"],
  accept_all: ["accept"],
};

export interface ActionState {
  openedSettings: boolean;
}

export type BannerAction<T> =
  | { type: "click"; control: T }
  | { type: "save"; control: T }
  | { type: "settings"; control: T };

/**
 * Decides the next step for one banner given the intents of its controls.
 * Direct answer first; otherwise a "save" button (the caller sets every
 * toggle to match the preference before clicking it); otherwise open the
 * settings layer once and re-scan.
 */
export function chooseAction<T extends { intent: ControlIntent }>(
  preference: CookiePreference,
  controls: readonly T[],
  state: ActionState,
): BannerAction<T> | null {
  for (const intent of INTENT_ORDER[preference]) {
    const control = controls.find((c) => c.intent === intent);
    if (control) return { type: "click", control };
  }
  const save = controls.find((c) => c.intent === "save");
  if (save) return { type: "save", control: save };
  if (!state.openedSettings) {
    const settings = controls.find((c) => c.intent === "settings");
    if (settings) return { type: "settings", control: settings };
  }
  return null;
}
