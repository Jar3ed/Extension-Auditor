import { runCookieEngine } from "../src/cookies/engine";

// Registered at runtime by src/cookies/registration.ts, only after the user
// opts in. An unlisted script, so WXT adds nothing to the manifest for it.
// One build per preference so the choice is known synchronously at
// document_start, before the page's own scripts run.
export default defineUnlistedScript(() => {
  runCookieEngine("accept_all");
});
