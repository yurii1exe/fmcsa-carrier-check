import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // The app's tsconfig sets `jsx: "preserve"` because Next does the transform.
  // Vitest has no Next in front of it, so the transform is named here — this
  // is what lets the component tests be written in JSX like the components.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The `server-only` package deliberately throws when it is imported
      // outside a React Server Component. That is exactly the guarantee we
      // want in the app and exactly what makes the modules untestable, so it
      // is stubbed here — and only here.
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    // `.tsx` as well as `.ts`: the components and the page are rendered to
    // HTML in the suite, not only the libraries underneath them.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
