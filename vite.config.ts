import { defineConfig } from "vite";

// Use dynamic import to load the ESM-only plugin at runtime.
// This avoids errors when Vite/esbuild tries to require() config dependencies.
export default defineConfig(async () => {
  const reactPlugin = (await import("@vitejs/plugin-react")).default;

  return {
    plugins: [reactPlugin()],
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    optimizeDeps: {
      include: ["maplibre-gl"],
    },
  };
});
