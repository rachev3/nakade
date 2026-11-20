// Web Worker entry. Only /api/* reaches this code (assets.run_worker_first in wrangler.jsonc);
// every other path is served straight from the static assets in dist/ with the SPA fallback.
import { handleApi } from "../api/src/worker.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api" || pathname.startsWith("/api/")) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
};
