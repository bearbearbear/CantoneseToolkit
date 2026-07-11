import assert from "node:assert/strict";
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
  assert.match(html, /粤拼方案/);
  assert.match(html, /Jyutping/);
  assert.match(html, /教材：广州话拼音/);
  assert.match(html, /Yale 数字式/);
  assert.match(html, /我今日唔想返工，可唔可以听日再讲？/);
  assert.doesNotMatch(html, /react-loading-skeleton|codex-preview|SkeletonPreview/);
});
