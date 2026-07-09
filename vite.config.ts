import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tanstackStart(), viteReact(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    exclude: [
      "vinxi/routes",
      "@tanstack/react-start",
      "@tanstack/start-server-core",
      "@tanstack/start-api-routes",
      "@tanstack/start",
      "#tanstack-start-entry",
      "#tanstack-router-entry",
    ],
  },
  ssr: {
    noExternal: [
      "vinxi",
      "@tanstack/react-start",
      "@tanstack/start-server-core",
      "@tanstack/start-api-routes",
      "@tanstack/start",
    ],
  },
});
