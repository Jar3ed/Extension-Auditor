import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "ExtSentinel",
    description:
      "Audits your installed Chrome extensions for permission risk and detects permission escalation on update.",
    permissions: ["management", "storage", "alarms"],
    // Tier 2 (deep scan) feature — do not add host_permissions here.
    // That will be requested at runtime via optional_host_permissions
    // once the opt-in deep-scan feature exists.
  },
});
