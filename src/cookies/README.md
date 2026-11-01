# Cookie-banner automation

Opt-in feature: the settings page (`entrypoints/cookies/`) switches between
**manual** (default — does nothing, requests no permissions) and
**automatic** with one of three preferences: _Deny all_, _Only necessary_,
_Accept all_.

## How a page visit is handled

1. **Invisible** (before the site's scripts run, `document_start`)
   - `Sec-GPC: 1` request header (declarativeNetRequest) and
     `navigator.globalPrivacyControl` (MAIN-world script) — deny/necessary only,
     never for accept-all.
   - `cmpDictionary.ts` writes the consent keys major CMPs read (OneTrust,
     CookieYes everywhere; Cookiebot only on origins where it was seen before,
     because `CookieConsent` is a name other banners use in other formats).
     Existing cookies are never overwritten.
   - Known CMP containers (`cmpSignatures.ts`) are pre-hidden by stylesheet.
2. **Fallback** — a MutationObserver finds banners (CMP signatures, then a
   multilingual text scan in `text.ts`), keeps them hidden, and clicks the
   control matching the preference. Settings layers are handled (open → reject,
   or untick toggles → save).
3. **Last resort** — if a banner is still showing after ~4 s (or has no usable
   control), it is restored exactly as it was and a short apology is shown.

## Permissions

Nothing is requested at install. Switching to automatic requests
`scripting`, `declarativeNetRequestWithHostAccess` and `http(s)://*/*` as
_optional_ permissions from the click; switching back to manual removes them.
The injected scripts are `defineUnlistedScript` entries registered at runtime
by `registration.ts` — **do not** change them to `defineContentScript` with
`registration: "runtime"`: WXT then adds their `matches` to the manifest's
`host_permissions`, which defeats the opt-in.

## Known limits

- "Deny all" and "Only necessary" differ only in which button is preferred and
  in the CMP keys' optional categories. A banner can't stop a site setting
  cookies it deems strictly necessary; truly blocking cookies would break
  logins and isn't attempted.
- CMP selectors and key formats are best-effort and can go stale; the text scan
  is the safety net. Formats we can't generate faithfully (IAB TCF
  `euconsent-v2`, Didomi tokens) are deliberately not written.
- Banners inside cross-origin iframes (e.g. Sourcepoint): the engine is
  registered with `allFrames`, so it runs inside the iframe, but this is
  **untested** and the parent frame can't hide the iframe element itself.
- Only open shadow roots are searched.
