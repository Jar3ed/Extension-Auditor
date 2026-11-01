import { describe, expect, it } from "vitest";
import { chooseAction, classifyControlText, type ControlIntent } from "./text";

describe("classifyControlText", () => {
  const cases: Array<[string, ControlIntent | null]> = [
    // reject
    ["Reject all", "reject"],
    ["  REJECT ALL COOKIES  ", "reject"],
    ["Decline", "reject"],
    ["Deny all", "reject"],
    ["Do not accept", "reject"],
    ["Continue without accepting →", "reject"],
    ["Alle ablehnen", "reject"],
    ["Tout refuser", "reject"],
    ["Rechazar todo", "reject"],
    ["Rifiuta tutto", "reject"],
    ["Alles weigeren", "reject"],
    ["Rejeitar tudo", "reject"],
    // necessary — must win over the "accept" inside the label
    ["Accept only necessary", "necessary"],
    ["Only necessary cookies", "necessary"],
    ["Use necessary cookies only", "necessary"],
    ["Essential cookies only", "necessary"],
    ["Nur notwendige Cookies", "necessary"],
    ["Uniquement les cookies nécessaires", "necessary"],
    ["Solo necesarias", "necessary"],
    ["Alleen noodzakelijke cookies", "necessary"],
    // accept
    ["Accept all", "accept"],
    ["Accept", "accept"],
    ["I agree", "accept"],
    ["Allow all cookies", "accept"],
    ["Got it!", "accept"],
    ["Alle akzeptieren", "accept"],
    ["Tout accepter", "accept"],
    ["Aceptar todo", "accept"],
    ["Accetta tutto", "accept"],
    // save / settings
    ["Save my choices", "save"],
    ["Allow selection", "save"],
    ["Confirm my choices", "save"],
    ["Cookie settings", "settings"],
    ["Manage preferences", "settings"],
    ["Customize", "settings"],
    ["Einstellungen", "settings"],
    // not decisions
    ["Read our privacy policy", null],
    ["Subscribe to our newsletter", null],
    ["Close", null],
    ["", null],
  ];

  it.each(cases)("classifies %j as %s", (label, expected) => {
    expect(classifyControlText(label)).toBe(expected);
  });

  it("ignores paragraph-length text, which is never a button label", () => {
    const paragraph =
      "We use cookies to improve your experience and you can accept them or reject them below";
    expect(classifyControlText(paragraph)).toBeNull();
  });

  it("does not confuse 'accept' inside 'do not accept' with consent", () => {
    expect(classifyControlText("I do not accept")).toBe("reject");
  });
});

describe("chooseAction", () => {
  const control = (intent: ControlIntent) => ({ intent });
  const fresh = { openedSettings: false };

  it("deny_all prefers reject over necessary", () => {
    const reject = control("reject");
    const action = chooseAction(
      "deny_all",
      [control("necessary"), reject, control("accept")],
      fresh,
    );
    expect(action).toEqual({ type: "click", control: reject });
  });

  it("necessary_only prefers necessary, falls back to reject", () => {
    const necessary = control("necessary");
    expect(
      chooseAction("necessary_only", [control("reject"), necessary], fresh),
    ).toEqual({ type: "click", control: necessary });

    const reject = control("reject");
    expect(chooseAction("necessary_only", [reject], fresh)).toEqual({
      type: "click",
      control: reject,
    });
  });

  it("accept_all only ever clicks accept", () => {
    expect(chooseAction("accept_all", [control("reject")], fresh)).toBeNull();
    const accept = control("accept");
    expect(
      chooseAction("accept_all", [control("reject"), accept], fresh),
    ).toEqual({ type: "click", control: accept });
  });

  it("never accepts when the preference is to deny", () => {
    for (const preference of ["deny_all", "necessary_only"] as const) {
      expect(chooseAction(preference, [control("accept")], fresh)).toBeNull();
    }
  });

  it("opens the settings layer once, then gives up rather than loop", () => {
    const settings = control("settings");
    expect(chooseAction("deny_all", [settings], fresh)).toEqual({
      type: "settings",
      control: settings,
    });
    expect(
      chooseAction("deny_all", [settings], { openedSettings: true }),
    ).toBeNull();
  });

  it("uses a save button when there is no direct answer", () => {
    const save = control("save");
    expect(
      chooseAction("deny_all", [save, control("settings")], fresh),
    ).toEqual({
      type: "save",
      control: save,
    });
  });
});
