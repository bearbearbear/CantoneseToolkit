import vinext from "vinext";
import { defineConfig } from "vite";
import type { Plugin, ViteDevServer } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

function serveStylesheetCssDirectly(): Plugin {
  return {
    name: "cantonese-tool-dev-css-direct",
    apply: "serve" as const,
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const requestUrl = new URL(req.url, "http://localhost");
        const isCssRequest = requestUrl.pathname.endsWith(".css");
        const hasSpecialCssQuery =
          requestUrl.searchParams.has("direct") ||
          requestUrl.searchParams.has("inline") ||
          requestUrl.searchParams.has("raw") ||
          requestUrl.searchParams.has("url");
        const acceptsCss = `${req.headers.accept ?? ""}`.includes("text/css");
        const isStyleFetch = req.headers["sec-fetch-dest"] === "style";

        if (!isCssRequest || hasSpecialCssQuery || (!acceptsCss && !isStyleFetch)) {
          next();
          return;
        }

        try {
          const cssUrl = `${requestUrl.pathname}${requestUrl.search ? `${requestUrl.search}&` : "?"}direct`;
          const result = await server.transformRequest(cssUrl);

          if (!result) {
            next();
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "text/css");
          res.setHeader("Cache-Control", "no-cache");
          res.end(result.code);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      serveStylesheetCssDirectly(),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
