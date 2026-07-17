import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const projectRoot = process.cwd();
const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/").at(-1) || "CantoneseToolkit";
const base = `/${repositoryName}/`;

export default defineConfig({
  root: resolve(projectRoot, "github-pages"),
  base,
  publicDir: resolve(projectRoot, "public"),
  css: {
    postcss: resolve(projectRoot, "postcss.config.mjs"),
  },
  plugins: [react()],
  build: {
    outDir: resolve(projectRoot, "pages-dist"),
    emptyOutDir: true,
  },
});
