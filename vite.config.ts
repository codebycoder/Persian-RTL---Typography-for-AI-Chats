import { copyFileSync, cpSync } from "node:fs";
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

      await build({
        configFile: false,
        publicDir: false,
        build: {
          emptyOutDir: false,
          outDir: distDir,
          lib: {
            entry: resolve(rootDir, "src/background/index.ts"),
            formats: ["es"],
            fileName: () => "background.js",
          },
        },
      });

      copyFileSync(resolve(rootDir, "manifest.json"), resolve(distDir, "manifest.json"));
      cpSync(resolve(rootDir, "fonts"), resolve(distDir, "fonts"), { recursive: true });
    },
  };
}

export default defineConfig({
  root: resolve(rootDir, "src/sidepanel"),
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
      input: resolve(rootDir, "src/sidepanel/sidepanel.html"),
      output: {
        entryFileNames: "sidepanel.js",
        assetFileNames: "sidepanel[extname]",
      },
    },
  },
  plugins: [stripCrossOrigin(), buildExtensionExtras()],
});
