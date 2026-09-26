import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  nitro: { preset: "node-server" },
  vite: { preview: { allowedHosts: ["cybersage-w8t3.onrender.com"] } },
});
