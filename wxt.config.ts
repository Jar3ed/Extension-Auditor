import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  webExt: {
    // Set WXT_NO_BROWSER=1 to skip auto-launching a browser (e.g. if
    // web-ext can't drive the one you have installed — sandboxed
    // flatpak/snap browsers are a common case). The dev server still
    // runs and rebuilds; load .output/chrome-mv3-dev unpacked yourself.
    disabled: !!process.env.WXT_NO_BROWSER,
  },
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
