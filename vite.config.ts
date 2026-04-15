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
      sourcemap: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, "src/client/index.html"),
        },
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (id.includes("@fluentui")) {
              return "fluentui";
            }
            if (id.includes("react-router")) {
              return "router";
            }
            if (id.includes("react-i18next") || id.includes("i18next")) {
              return "i18n";
            }
            if (id.includes("@microsoft/teams-js") || id.includes("@azure/msal")) {
              return "teams";
            }

            return "vendor";
          },
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
