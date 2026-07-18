import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Cantonese conversion tool", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(html, /<title>中文转粤语发音工具<\/title>/i);
  assert.match(html, /中文转地道粤语/);
  assert.match(html, /粤语表达/);
  assert.match(html, /转换引擎/);
  assert.match(html, /规则版/);
  assert.match(html, /自然版/);
  assert.match(html, /表达风格/);
  assert.match(html, /偏好设置/);
  assert.match(html, /转换设置/);
  assert.match(html, /输出拼音方案/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(css, /\.settings-button\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /\.intro,\s*\.hero-actions\s*\{\s*display:\s*none;/s);
  assert.match(css, /height:\s*calc\(3 \* 1\.6em \+ 30px\)/);
  assert.match(html, /标准/);
  assert.match(html, /香港字形/);
  assert.match(html, /Jyutping/);
  assert.match(html, /教材：广州话拼音/);
  assert.match(html, /Yale 数字式/);
  assert.match(html, /教院拼音/);
  assert.match(html, /方案解释/);
  assert.match(html, /声母/);
  assert.match(html, /韵母/);
  assert.match(html, /声调/);
  assert.match(html, /示例/);
  assert.match(html, /香港 hoeng1 gong2/);
  assert.match(html, /我今日唔想返工，可唔可以聽日再講？/);
  assert.match(html, /<button[^>]+class="jyutping-unit"[^>]+aria-label="朗读 我/);
  assert.match(html, /title="单独发音"/);
  assert.match(html, /离线状态/);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(html, /react-loading-skeleton|codex-preview|SkeletonPreview/);
});

test("offline assets are available for browser caching", () => {
  const serviceWorkerUrl = new URL("../public/sw.js", import.meta.url);
  const manifestUrl = new URL("../public/manifest.webmanifest", import.meta.url);
  const appleIconUrl = new URL("../public/apple-touch-icon.png", import.meta.url);
  const icon192Url = new URL("../public/icon-192.png", import.meta.url);
  const icon512Url = new URL("../public/icon-512.png", import.meta.url);

  assert.equal(existsSync(serviceWorkerUrl), true);
  assert.equal(existsSync(manifestUrl), true);
  assert.equal(existsSync(appleIconUrl), true);
  assert.equal(existsSync(icon192Url), true);
  assert.equal(existsSync(icon512Url), true);

  const serviceWorker = readFileSync(serviceWorkerUrl, "utf8");
  const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));

  assert.match(serviceWorker, /cantonese-tool-offline-v3/);
  assert.match(serviceWorker, /fetch/);
  assert.match(serviceWorker, /apple-touch-icon\.png/);
  assert.match(serviceWorker, /self\.registration\.scope/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.deepEqual(
    manifest.icons.map((icon) => icon.src),
    ["/favicon.svg", "/icon-192.png", "/icon-512.png"],
  );
});

test("GitHub Pages build uses the repository subpath", () => {
  const pagesRoot = new URL("../pages-dist/", import.meta.url);
  const html = readFileSync(new URL("index.html", pagesRoot), "utf8");
  const manifest = JSON.parse(
    readFileSync(new URL("manifest.webmanifest", pagesRoot), "utf8"),
  );

  assert.match(html, /中文转粤语发音工具/);
  assert.match(html, /\/CantoneseToolkit\/assets\//);
  assert.match(html, /\/CantoneseToolkit\/manifest\.webmanifest/);
  assert.equal(manifest.start_url, "/CantoneseToolkit/");
  assert.equal(manifest.scope, "/CantoneseToolkit/");
  assert.equal(existsSync(new URL(".nojekyll", pagesRoot)), true);
  assert.equal(existsSync(new URL("404.html", pagesRoot)), true);
});
