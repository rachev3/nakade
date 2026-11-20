// Local API server: the whole draft contract (apps/web/src/api/openapi.yaml) on top of the real
// matching engine and the 90 settlements. Plain node:http, sessions in memory (lost on restart).
//
//   npm run serve                # data from MongoDB Atlas (data/pipeline/.env)
//   npm run serve -- --offline   # data from data/processed/settlements_enriched.json
//
// The frontend talks to it with `pnpm --filter @nakade/web dev:live` (Vite proxies /api → :8787).

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createEngine, DIMENSIONS } from "./engine/index.js";
import { buildPlan, buildSimulation } from "./narratives.js";

const { values: args } = parseArgs({
  options: { offline: { type: "boolean", default: false }, port: { type: "string", default: process.env.PORT ?? "8787" } },
});

const settlements = args.offline
  ? JSON.parse(readFileSync(new URL("../../../data/processed/settlements_enriched.json", import.meta.url), "utf8")).settlements
  : await (await import("./db.js")).loadSettlements();
const engine = createEngine(settlements);
const CONTRACT_DIMS = new Set(DIMENSIONS);

// ---------- sessions (in memory) ----------
const ORDER = { none: 0, quick: 1, detailed: 2 };
const sessions = new Map();
function sessionOf(req, res) {
  const sid = /(?:^|;\s*)nakade_sid=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
  if (sid && sessions.has(sid)) return sessions.get(sid);
  const s = {
    session: { session_id: randomUUID(), created_at: new Date().toISOString() },
    profile: { completeness: "none", answers: {}, updated_at: new Date(0).toISOString() },
    swipes: [],
  };
  sessions.set(s.session.session_id, s);
  res.setHeader("Set-Cookie", `nakade_sid=${s.session.session_id}; Path=/; HttpOnly; SameSite=Lax`);
  return s;
}

// ---------- contract helpers ----------
/** The contract's Dimension enum has no `housing` yet: it still counts in the score, but is not sent. */
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

function toSettlement(s) {
  const nearby = settlements
    .filter((x) => x.ekatte !== s.ekatte && (x.parent_town_ekatte === s.ekatte || x.ekatte === s.parent_town_ekatte || (s.parent_town_ekatte && x.parent_town_ekatte === s.parent_town_ekatte)))
    .map((x) => ({ settlement: engine.summary(x), drive_min: null }));
  return { ...engine.summary(s), facts: s.facts, nearby };
}

// ---------- routing ----------
const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
  });

const routes = [
  ["POST", /^\/api\/session$/, (req, res, ctx) => send(res, 200, ctx.s.session)],
  ["GET", /^\/api\/profile$/, (req, res, ctx) => send(res, 200, ctx.s.profile)],
  [
    "PATCH",
    /^\/api\/profile$/,
    async (req, res, ctx) => {
      const patch = await readBody(req);
      const p = ctx.s.profile;
      const completeness = patch.completeness && ORDER[patch.completeness] > ORDER[p.completeness] ? patch.completeness : p.completeness;
      ctx.s.profile = { completeness, answers: { ...p.answers, ...patch.answers }, updated_at: new Date().toISOString() };
      send(res, 200, ctx.s.profile);
    },
  ],
  [
    "GET",
    /^\/api\/settlements$/,
    (req, res, ctx) => {
      const type = ctx.url.searchParams.get("type");
      send(res, 200, settlements.filter((s) => !type || s.type === type).map(engine.summary));
    },
  ],
  [
    "GET",
    /^\/api\/settlements\/(\d{5})$/,
    (req, res, ctx) => {
      const s = engine.get(ctx.m[1]);
      return s ? send(res, 200, toSettlement(s)) : send(res, 404, { code: "not_found", message: `Unknown EKATTE ${ctx.m[1]}` });
    },
  ],
  [
    "POST",
    /^\/api\/matches$/,
    async (req, res, ctx) => {
      const body = await readBody(req);
      const swiped = new Set(ctx.s.swipes.map((x) => x.ekatte));
      const result = engine.rank(ctx.s.profile.answers, { ekatte: body.ekatte, type: body.type, limit: 1000 });
      if (!result.ok) return send(res, 400, { code: "invalid_profile", message: result.errors.join("; ") });
      const matches = result.matches.filter((m) => !body.exclude_swiped || !swiped.has(m.ekatte)).slice(0, body.limit ?? 20);
      send(res, 200, matches.map(toContract));
    },
  ],
  [
    "POST",
    /^\/api\/swipes$/,
    async (req, res, ctx) => {
      const swipe = await readBody(req);
      ctx.s.swipes = ctx.s.swipes.filter((x) => x.ekatte !== swipe.ekatte);
      ctx.s.swipes.push({ ...swipe, created_at: new Date().toISOString() });
      send(res, 204);
    },
  ],
  [
    "GET",
    /^\/api\/saved$/,
    (req, res, ctx) => {
      const saved = ctx.s.swipes
        .filter((x) => x.action !== "dislike" && engine.get(x.ekatte))
        .map((x) => ({ settlement: engine.summary(engine.get(x.ekatte)), action: x.action, created_at: x.created_at }));
      send(res, 200, saved.reverse());
    },
  ],
  [
    "POST",
    /^\/api\/settlements\/(\d{5})\/simulation$/,
    (req, res, ctx) => {
      const s = engine.get(ctx.m[1]);
      return s ? send(res, 200, buildSimulation(s, ctx.s.profile.answers)) : send(res, 404, { code: "not_found", message: `Unknown EKATTE ${ctx.m[1]}` });
    },
  ],
  [
    "POST",
    /^\/api\/settlements\/(\d{5})\/plan$/,
    (req, res, ctx) => {
      const s = engine.get(ctx.m[1]);
      return s ? send(res, 200, buildPlan(s, ctx.s.profile.answers)) : send(res, 404, { code: "not_found", message: `Unknown EKATTE ${ctx.m[1]}` });
    },
  ],
];

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const route = routes.find(([method, re]) => method === req.method && re.test(url.pathname));
  if (!route) return send(res, 404, { code: "not_found", message: `${req.method} ${url.pathname}` });
  try {
    await route[2](req, res, { url, m: route[1].exec(url.pathname), s: sessionOf(req, res) });
    console.log(`${req.method} ${url.pathname} → ${res.statusCode}`);
  } catch (err) {
    console.error(err);
    send(res, 500, { code: "internal", message: err.message });
  }
}).listen(Number(args.port), () => {
  console.log(`nakade API on http://localhost:${args.port} · ${settlements.length} settlements (${args.offline ? "offline file" : "MongoDB"})`);
});
