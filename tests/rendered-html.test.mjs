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
  assert.match(html, /<title>中文转粤语发音工具<\/title>/i);
  assert.match(html, /中文转地道粤语/);
  assert.match(html, /粤语表达/);
  assert.match(html, /转换引擎/);
  assert.match(html, /规则版/);
  assert.match(html, /自然版/);
  assert.match(html, /表达风格/);
  assert.match(html, /标准/);
  assert.match(html, /香港字形/);
  assert.match(html, /粤拼方案/);
  assert.match(html, /Jyutping/);
  assert.match(html, /教材：广州话拼音/);
  assert.match(html, /Yale 数字式/);
  assert.match(html, /教院拼音/);
  assert.match(html, /我今日唔想返工，可唔可以聽日再講？/);
  assert.match(html, /离线状态/);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(html, /react-loading-skeleton|codex-preview|SkeletonPreview/);
});

test("offline assets are available for browser caching", () => {
  const serviceWorkerUrl = new URL("../public/sw.js", import.meta.url);
  const manifestUrl = new URL("../public/manifest.webmanifest", import.meta.url);

  assert.equal(existsSync(serviceWorkerUrl), true);
  assert.equal(existsSync(manifestUrl), true);

  const serviceWorker = readFileSync(serviceWorkerUrl, "utf8");
  const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));

  assert.match(serviceWorker, /cantonese-tool-offline-v1/);
  assert.match(serviceWorker, /fetch/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
});
