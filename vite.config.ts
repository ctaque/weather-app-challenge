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
      include: ['react-map-gl', 'mapbox-gl'],
    },
    resolve: {
      alias: {
        'react-map-gl': 'react-map-gl/dist/esm/index.js',
      },
    },
  };
});
