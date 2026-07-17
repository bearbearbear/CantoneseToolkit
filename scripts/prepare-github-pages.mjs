import { copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve(process.cwd(), "pages-dist");
const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/").at(-1) || "CantoneseToolkit";
const base = `/${repositoryName}/`;
const manifestPath = resolve(outputDirectory, "manifest.webmanifest");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

manifest.start_url = base;
manifest.scope = base;
manifest.icons = manifest.icons.map((icon) => ({
  ...icon,
  src: `${base}${icon.src.replace(/^\//, "")}`,
}));

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(resolve(outputDirectory, ".nojekyll"), "");
await copyFile(
  resolve(outputDirectory, "index.html"),
  resolve(outputDirectory, "404.html"),
);
