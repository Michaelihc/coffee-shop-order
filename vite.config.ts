import { resolve } from "path";

async function getConfig() {
  const { defineConfig } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;

  return defineConfig({
    plugins: [react()],
    define: {
      global: "globalThis",
    },
    base: "/app/",
    root: resolve(__dirname, "src/client"),
    build: {
      outDir: resolve(__dirname, "lib/client"),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, "src/client/index.html"),
        },
      },
    },
    server: {
      proxy: {
        "/api": "http://localhost:3333",
      },
    },
  });
}

export default getConfig();
