// Registered at runtime in the page's MAIN world (see
// src/cookies/registration.ts) so sites reading navigator.globalPrivacyControl
// see the Global Privacy Control signal alongside the Sec-GPC request header.
export default defineUnlistedScript(() => {
  try {
    Object.defineProperty(Navigator.prototype, "globalPrivacyControl", {
      get: () => true,
      configurable: true,
      enumerable: true,
    });
  } catch {
    // Already defined non-configurably by the browser — nothing to do.
  }
});
