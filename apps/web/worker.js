// Web Worker entry. Only /api/* reaches this code (assets.run_worker_first in wrangler.jsonc);
// every other path is served straight from the static assets in dist/ with the SPA fallback.
import { cleanupSessions, handleApi } from "../api/src/worker.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api" || pathname.startsWith("/api/")) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
  // Cron trigger (wrangler.jsonc → triggers.crons): forget sessions nobody used for 180 days.
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(cleanupSessions(env));
  },
};
