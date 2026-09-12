import { copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, build, type Plugin } from "vite";

const rootDir = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(rootDir, "dist");
const sharedAlias = {
  "@shared": resolve(rootDir, "src/shared"),
};

function stripCrossOrigin(): Plugin {
  return {
    name: "strip-crossorigin",
    transformIndexHtml(html) {
      return html.replaceAll(" crossorigin", "");
    },
  };
}

function buildExtensionExtras(): Plugin {
  return {
    name: "build-extension-extras",
    async closeBundle() {
      await build({
        configFile: false,
        publicDir: false,
        resolve: {
          alias: sharedAlias,
        },
        build: {
          emptyOutDir: false,
          outDir: distDir,
          sourcemap: false,
          minify: true,
          lib: {
            entry: resolve(rootDir, "src/content/index.ts"),
            name: "chatFontCustomizerContent",
            formats: ["iife"],
            fileName: () => "content.js",
          },
          rollupOptions: {
            output: {
              extend: true,
            },
          },
        },
      });

      copyFileSync(resolve(rootDir, "manifest.json"), resolve(distDir, "manifest.json"));
    },
  };
}

export default defineConfig({
  root: resolve(rootDir, "src/popup"),
  base: "./",
  publicDir: resolve(rootDir, "public"),
  resolve: {
    alias: sharedAlias,
  },
  build: {
    outDir: distDir,
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      input: resolve(rootDir, "src/popup/popup.html"),
      output: {
        entryFileNames: "popup.js",
        assetFileNames: "popup[extname]",
      },
    },
  },
  plugins: [stripCrossOrigin(), buildExtensionExtras()],
});
