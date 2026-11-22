// The API as a Cloudflare Worker handler: the same contract and engine as src/server.mjs, for the
// deployed environments. Differences from the local server:
//   - settlements come from data/processed/settlements_enriched.json, bundled into the Worker (no MongoDB,
//     no DB credentials at all)
//   - sessions live in D1 (binding DB), not in memory, because Worker isolates come and go
//   - hardened for a public URL: input validation, body size limit, generic 500s, Secure cookie,
//     optional per-IP rate limit (binding API_LIMITER)
//
// apps/web/worker.js routes /api/* here; everything else is served from static assets.

import data from "../../../data/processed/settlements_enriched.json";
import { createEngine, DIMENSIONS } from "./engine/index.js";
import { buildPlan, buildSimulation } from "./narratives.js";

const settlements = data.settlements;
const engine = createEngine(settlements);
const CONTRACT_DIMS = new Set(DIMENSIONS);

const MAX_BODY_BYTES = 16 * 1024;
// Sessions unused this long are deleted by the daily cron, and the cookie lives no longer.
export const SESSION_TTL_DAYS = 180;
const MAX_MATCH_LIMIT = 100;
const ORDER = { none: 0, quick: 1, detailed: 2 };
const SWIPE_ACTIONS = new Set(["like", "dislike", "save"]);
const SETTLEMENT_TYPES = new Set(["town", "village"]);
const EKATTE_RE = /^\d{5}$/;
const SID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const bad = (message) => new HttpError(400, "bad_request", message);
const notFound = (message) => new HttpError(404, "not_found", message);

// ---------- sessions (D1) ----------
// One row per session; profile and swipes as JSON. Rows are written only when something changes,
// so read-only traffic (and bots) never creates rows.
let schemaReady = null;
function ensureSchema(db) {
  schemaReady ??= db
    .exec(
      "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, profile TEXT NOT NULL, swipes TEXT NOT NULL)",
    )
    .catch((err) => {
      schemaReady = null;
      throw err;
    });
  return schemaReady;
}

const freshSession = (id = crypto.randomUUID()) => ({
  session: { session_id: id, created_at: new Date().toISOString() },
  profile: { completeness: "none", answers: {}, updated_at: new Date(0).toISOString() },
  swipes: [],
  isNew: true,
});

async function loadSession(db, request) {
  const sid = /(?:^|;\s*)nakade_sid=([^;]+)/.exec(request.headers.get("Cookie") ?? "")?.[1];
  if (!sid || !SID_RE.test(sid)) return freshSession();
  const row = await db.prepare("SELECT id, created_at, profile, swipes FROM sessions WHERE id = ?").bind(sid).first();
  if (!row) return freshSession(); // unknown or expired id: start over with a new one
  return {
    session: { session_id: row.id, created_at: row.created_at },
    profile: JSON.parse(row.profile),
    swipes: JSON.parse(row.swipes),
    isNew: false,
  };
}

async function saveSession(db, s) {
  await db
    .prepare(
      "INSERT INTO sessions (id, created_at, updated_at, profile, swipes) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(id) DO UPDATE SET updated_at = ?3, profile = ?4, swipes = ?5",
    )
    .bind(s.session.session_id, s.session.created_at, new Date().toISOString(), JSON.stringify(s.profile), JSON.stringify(s.swipes))
    .run();
  s.isNew = false;
}

async function deleteSession(db, s) {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(s.session.session_id).run();
}

/** Cron: delete sessions not updated for SESSION_TTL_DAYS. */
export async function cleanupSessions(env) {
  if (!env.DB) return;
  await ensureSchema(env.DB);
  const cutoff = new Date(Date.now() - SESSION_TTL_DAYS * 864e5).toISOString();
  const res = await env.DB.prepare("DELETE FROM sessions WHERE updated_at < ?").bind(cutoff).run();
  console.log("session cleanup", { cutoff, deleted: res.meta?.changes ?? null });
}

/** "bg" unless the client asks for English (Accept-Language), like the frontend's language switch. */
const langOf = (request) => ((request.headers.get("Accept-Language") ?? "").toLowerCase().startsWith("en") ? "en" : "bg");

// ---------- contract helpers (same as server.mjs) ----------
function toContract(m) {
  const keep = (x) => CONTRACT_DIMS.has(x.dimension ?? x.key ?? x.text_key?.split(".")[1]) || x.text_key?.startsWith("constraint.");
  return {
    ...m,
    dimensions: m.dimensions.filter((d) => CONTRACT_DIMS.has(d.key)),
    reasons: m.reasons.filter(keep),
    tradeoffs: m.tradeoffs.filter(keep),
    unknowns: m.unknowns.filter((u) => CONTRACT_DIMS.has(u.dimension)),
  };
}

function toSettlement(s, lang) {
  const nearby = settlements
    .filter((x) => x.ekatte !== s.ekatte && (x.parent_town_ekatte === s.ekatte || x.ekatte === s.parent_town_ekatte || (s.parent_town_ekatte && x.parent_town_ekatte === s.parent_town_ekatte)))
    .map((x) => ({ settlement: engine.summary(x, lang), drive_min: null }));
  return { ...engine.summary(s, lang), facts: s.facts, nearby };
}

function settlementOr404(ekatte) {
  const s = engine.get(ekatte);
  if (!s) throw notFound(`Unknown EKATTE ${ekatte}`);
  return s;
}

// ---------- input ----------
const isPlainObject = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

async function readJson(request) {
  const declared = Number(request.headers.get("Content-Length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, "payload_too_large", `Body over ${MAX_BODY_BYTES} bytes`);
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) throw new HttpError(413, "payload_too_large", `Body over ${MAX_BODY_BYTES} bytes`);
  if (!raw) return {};
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw bad("Body is not valid JSON");
  }
  if (!isPlainObject(body)) throw bad("Body must be a JSON object");
  return body;
}

function parseMatchRequest(body) {
  const out = { exclude_swiped: body.exclude_swiped === true, limit: 20 };
  if (body.limit !== undefined) {
    if (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > MAX_MATCH_LIMIT) throw bad(`limit must be an integer 1..${MAX_MATCH_LIMIT}`);
    out.limit = body.limit;
  }
  if (body.type !== undefined) {
    if (!SETTLEMENT_TYPES.has(body.type)) throw bad("type must be town or village");
    out.type = body.type;
  }
  if (body.ekatte !== undefined) {
    if (!Array.isArray(body.ekatte) || body.ekatte.length > settlements.length || !body.ekatte.every((e) => typeof e === "string" && EKATTE_RE.test(e)))
      throw bad("ekatte must be an array of 5-digit codes");
    out.ekatte = body.ekatte;
  }
  return out;
}

// ---------- routes ----------
// handler(ctx) returns [status, body]. `write: true` routes persist the session afterwards.
const routes = [
  ["POST", /^\/api\/session$/, { write: true }, (ctx) => [200, ctx.s.session]],
  // "Delete my data": removes the session row (profile, answers, likes) and expires the cookie.
  ["DELETE", /^\/api\/session$/, { erase: true }, () => [204]],
  ["GET", /^\/api\/profile$/, {}, (ctx) => [200, ctx.s.profile]],
  [
    "PATCH",
    /^\/api\/profile$/,
    { write: true },
    async (ctx) => {
      const patch = await readJson(ctx.request);
      if (patch.answers !== undefined && !isPlainObject(patch.answers)) throw bad("answers must be an object");
      if (patch.completeness !== undefined && !Object.hasOwn(ORDER, patch.completeness)) throw bad("completeness must be none, quick or detailed");
      const p = ctx.s.profile;
      const completeness = patch.completeness && ORDER[patch.completeness] > ORDER[p.completeness] ? patch.completeness : p.completeness;
      ctx.s.profile = { completeness, answers: { ...p.answers, ...patch.answers }, updated_at: new Date().toISOString() };
      return [200, ctx.s.profile];
    },
  ],
  [
    "GET",
    /^\/api\/settlements$/,
    {},
    (ctx) => {
      const type = ctx.url.searchParams.get("type");
      if (type && !SETTLEMENT_TYPES.has(type)) throw bad("type must be town or village");
      return [200, settlements.filter((s) => !type || s.type === type).map((x) => engine.summary(x, ctx.lang))];
    },
  ],
  ["GET", /^\/api\/settlements\/(\d{5})$/, {}, (ctx) => [200, toSettlement(settlementOr404(ctx.m[1]), ctx.lang)]],
  [
    "POST",
    /^\/api\/matches$/,
    {},
    async (ctx) => {
      const req = parseMatchRequest(await readJson(ctx.request));
      const swiped = new Set(ctx.s.swipes.map((x) => x.ekatte));
      const result = engine.rank(ctx.s.profile.answers, { ekatte: req.ekatte, type: req.type, limit: 1000, lang: ctx.lang });
      if (!result.ok) throw new HttpError(400, "invalid_profile", result.errors.join("; "));
      const matches = result.matches.filter((m) => !req.exclude_swiped || !swiped.has(m.ekatte)).slice(0, req.limit);
      return [200, matches.map(toContract)];
    },
  ],
  [
    "POST",
    /^\/api\/swipes$/,
    { write: true },
    async (ctx) => {
      const swipe = await readJson(ctx.request);
      if (typeof swipe.ekatte !== "string" || !EKATTE_RE.test(swipe.ekatte)) throw bad("ekatte must be a 5-digit code");
      settlementOr404(swipe.ekatte);
      if (!SWIPE_ACTIONS.has(swipe.action)) throw bad("action must be like, dislike or save");
      ctx.s.swipes = ctx.s.swipes.filter((x) => x.ekatte !== swipe.ekatte); // at most one per settlement
      ctx.s.swipes.push({ ekatte: swipe.ekatte, action: swipe.action, created_at: new Date().toISOString() });
      return [204];
    },
  ],
  [
    "GET",
    /^\/api\/saved$/,
    {},
    (ctx) => {
      const saved = ctx.s.swipes
        .filter((x) => x.action !== "dislike" && engine.get(x.ekatte))
        .map((x) => ({ settlement: engine.summary(engine.get(x.ekatte), ctx.lang), action: x.action, created_at: x.created_at }));
      return [200, saved.reverse()];
    },
  ],
  ["POST", /^\/api\/settlements\/(\d{5})\/simulation$/, {}, (ctx) => [200, buildSimulation(settlementOr404(ctx.m[1]), ctx.s.profile.answers, ctx.lang)]],
  ["POST", /^\/api\/settlements\/(\d{5})\/plan$/, {}, (ctx) => [200, buildPlan(settlementOr404(ctx.m[1]), ctx.s.profile.answers, ctx.lang)]],
];

// ---------- entry ----------
function json(status, body, extraHeaders = {}) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders };
  if (status === 204 || body === undefined) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}

/**
 * @param {Request} request
 * @param {{ DB?: D1Database, API_LIMITER?: { limit(o: { key: string }): Promise<{ success: boolean }> } }} env
 */
export async function handleApi(request, env) {
  const url = new URL(request.url);
  if (!env.DB) return json(503, { code: "unavailable", message: "API is not enabled in this environment" });

  if (env.API_LIMITER) {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await env.API_LIMITER.limit({ key: ip });
    if (!success) return json(429, { code: "rate_limited", message: "Too many requests, slow down" }, { "Retry-After": "60" });
  }

  const route = routes.find(([method, re]) => method === request.method && re.test(url.pathname));
  if (!route) return json(404, { code: "not_found", message: `${request.method} ${url.pathname}` });
  const [, re, opts, handler] = route;

  try {
    await ensureSchema(env.DB);
    const s = await loadSession(env.DB, request);
    const wasNew = s.isNew;
    const [status, body] = await handler({ request, url, m: re.exec(url.pathname), s, lang: langOf(request) });
    if (opts.erase) {
      if (!wasNew) await deleteSession(env.DB, s);
      const secure = url.protocol === "https:" ? "; Secure" : "";
      return json(status, body, { "Set-Cookie": `nakade_sid=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure}` });
    }
    if (opts.write) await saveSession(env.DB, s);

    const headers = {};
    // Hand out the cookie only once the session exists in D1, so read-only visits leave no trace.
    if (wasNew && !s.isNew) {
      const secure = url.protocol === "https:" ? "; Secure" : "";
      headers["Set-Cookie"] = `nakade_sid=${s.session.session_id}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_DAYS * 86400}${secure}`;
    }
    return json(status, body, headers);
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { code: err.code, message: err.message });
    console.error("api error", request.method, url.pathname, err); // full detail only in Workers Logs
    return json(500, { code: "internal", message: "Something went wrong" });
  }
}
