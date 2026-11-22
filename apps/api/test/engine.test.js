// Golden tests for the matching engine, offline on data/processed/settlements_enriched.json
// (the same 90 settlements the seed writes to MongoDB). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEngine, DIMENSIONS } from "../src/engine/index.js";
import { PERSONAS } from "../scripts/personas.js";

const data = JSON.parse(readFileSync(new URL("../../../data/processed/settlements_enriched.json", import.meta.url), "utf8"));
const engine = createEngine(data.settlements);
const byEkatte = new Map(data.settlements.map((s) => [s.ekatte, s]));
const fact = (ekatte, metric) => byEkatte.get(ekatte).facts.find((f) => f.metric === metric);
const all = (answers, req = {}) => engine.rank(answers, { limit: 1000, ...req });

test("data: 90 settlements, every fact has provenance", () => {
  assert.equal(data.settlements.length, 90);
  for (const s of data.settlements)
    for (const f of s.facts) {
      assert.ok(["verified", "derived", "estimated"].includes(f.status), `${f.id} status`);
      assert.ok(f.source?.id && f.retrieved_at, `${f.id} source`);
    }
});

test("deterministic: same answers → identical output", () => {
  assert.deepEqual(all(PERSONAS.remote_family.answers), all(PERSONAS.remote_family.answers));
});

test("contract shape: Match fields, weights sum to 1, scores in 0..1", () => {
  for (const p of Object.values(PERSONAS)) {
    const res = all(p.answers);
    assert.ok(res.ok, res.errors?.join("; "));
    const wsum = Object.values(res.weights).reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(wsum - 1) < 0.01, `weights sum ${wsum}`);
    for (const m of res.matches) {
      for (const k of ["ekatte", "settlement", "score", "confidence", "passes_constraints", "dimensions", "reasons", "tradeoffs", "unknowns"])
        assert.ok(k in m, `missing ${k}`);
      assert.ok(m.score >= 0 && m.score <= 1 && m.confidence >= 0 && m.confidence <= 1);
      for (const d of m.dimensions) assert.ok([...DIMENSIONS, "housing"].includes(d.key));
      for (const e of [...m.reasons, ...m.tradeoffs, ...m.excluded_because]) {
        assert.match(e.text_key, /^(reason|tradeoff|constraint)\./);
        assert.ok(e.text && e.fact_ids.length);
      }
    }
  }
});

test("every evidence / fact id points at a real fact", () => {
  for (const p of Object.values(PERSONAS))
    for (const m of all(p.answers).matches) {
      const ids = new Set([...byEkatte.get(m.ekatte).facts.map((f) => f.id), ...m.facts.map((f) => f.id)]);
      for (const id of m.dimensions.flatMap((d) => d.evidence)) assert.ok(ids.has(id), id);
      for (const e of [...m.reasons, ...m.tradeoffs, ...m.excluded_because]) for (const id of e.fact_ids) assert.ok(ids.has(id), id);
    }
});

test("ordering: places that pass the must-haves come first, then by score", () => {
  const ms = all(PERSONAS.retired_no_car.answers).matches;
  const firstFail = ms.findIndex((m) => !m.passes_constraints);
  assert.ok(firstFail > 0, "some pass, some fail");
  assert.ok(ms.slice(firstFail).every((m) => !m.passes_constraints));
  for (let i = 1; i < firstFail; i++) assert.ok(ms[i - 1].score >= ms[i].score);
});

test("must-haves: hospital_30min and pharmacy are enforced", () => {
  for (const m of all(PERSONAS.retired_no_car.answers).matches) {
    const h = fact(m.ekatte, "hospital_nearest_km").value;
    const ph = fact(m.ekatte, "pharmacy_count").value > 0 || fact(m.ekatte, "pharmacy_nearest_km").value <= 3;
    assert.equal(m.passes_constraints, h <= 20 && ph, m.settlement.name_bg);
  }
});

test("the user's current location is never suggested", () => {
  assert.ok(!all(PERSONAS.hybrid_commuter.answers).matches.some((m) => m.ekatte === "68134"));
});

test("golden: remote family (mountains, forest, school, fast internet) → high, green places that pass", () => {
  const top = all(PERSONAS.remote_family.answers).matches.slice(0, 3);
  assert.ok(top.every((m) => m.passes_constraints));
  const avgElev = top.reduce((s, m) => s + fact(m.ekatte, "elevation_m").value, 0) / 3;
  assert.ok(avgElev > 500, `avg elevation ${avgElev}`);
});

test("golden: hybrid commuter from Sofia (≤ 40 min) → top 3 within 40 min of Sofia", () => {
  const top = all(PERSONAS.hybrid_commuter.answers).matches.slice(0, 3);
  for (const m of top) assert.ok(m.facts[0].value <= 40, `${m.settlement.name_bg}: ${m.facts[0].value} min`);
});

test("golden: job seeker without a car → towns with unemployment below the national 5.27%", () => {
  for (const m of all(PERSONAS.young_jobseeker.answers).matches.slice(0, 5)) {
    assert.equal(m.settlement.type, "town");
    assert.ok(fact(m.ekatte, "unemployment_rate_pct").value < 5.27, m.settlement.name_bg);
  }
});

test("no guessing: wishes we have no data for show up as unknowns", () => {
  const sea = all({ nature: ["sea"] }).matches[0];
  assert.ok(sea.unknowns.some((u) => u.dimension === "nature" && u.missing.includes("sea_distance_km")));
  const train = all({ must_haves: ["train_to_sofia"] }).matches.find((m) => m.passes_constraints);
  assert.ok(train.unknowns.some((u) => u.missing.includes("train_lines_to_sofia")));
});

test("housing: only with a budget for renting; village prices are estimates", () => {
  assert.ok(!all({ housing: "buy", budget_eur_month: 500 }).matches[0].dimensions.some((d) => d.key === "housing"));
  assert.ok(all({ housing: "rent", budget_eur_month: 500 }).matches[0].dimensions.some((d) => d.key === "housing"));
  for (const s of data.settlements.filter((x) => x.type === "village"))
    assert.equal(fact(s.ekatte, "rent_2room_eur_month").status, "estimated", s.name_bg);
});

test("weights follow the answers", () => {
  const retired = all({ household: "retired" });
  assert.equal(retired.weights.employment, 0);
  assert.ok(!retired.matches[0].dimensions.some((d) => d.key === "employment"));
  const kids = all({ household: "family_kids" }).weights;
  const single = all({ household: "single" }).weights;
  assert.ok(kids.education > single.education * 5);
  const comp = all({ priorities: ["nature"], compromises: ["nature"] }).weights;
  assert.ok(comp.nature < all({ priorities: ["nature"] }).weights.nature);
});

test("filters: type and ekatte from MatchRequest", () => {
  assert.ok(all({}, { type: "village" }).matches.every((m) => m.settlement.type === "village"));
  assert.deepEqual(all({}, { ekatte: ["73403", "00583"] }).matches.map((m) => m.ekatte).sort(), ["00583", "73403"]);
});

test("validation: bad answers are rejected with readable errors", () => {
  const bad = engine.rank({ household: "dog", priorities: ["nature", "transport", "education", "amenities"], current_location: "99999" });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.startsWith("household")));
  assert.ok(bad.errors.some((e) => e.startsWith("priorities")));
  assert.ok(bad.errors.some((e) => e.startsWith("current_location")));
  assert.ok(engine.rank({}).ok, "empty answers are fine (progressive profiling)");
});

// ---------- the 10 / 30 question onboarding ----------

test("max_home_distance: places further than the limit fail the constraints", () => {
  const ms = all({ current_location: "68134", max_home_distance: "up_to_1h" }).matches;
  for (const m of ms) assert.equal(m.passes_constraints, m.facts[0].value <= 60, m.settlement.name_bg);
  assert.ok(ms.some((m) => !m.passes_constraints && m.excluded_because[0].text_key === "constraint.max_home_distance"));
});

test("place_type steers the size of the suggested places", () => {
  const cities = all({ place_type: "city", priorities: ["demographics"] }).matches.slice(0, 5);
  assert.ok(cities.every((m) => m.settlement.population >= 30000), cities.map((m) => m.settlement.name_bg).join(", "));
  const villages = all({ place_type: "village", priorities: ["demographics"] }).matches.slice(0, 5);
  assert.ok(villages.every((m) => m.settlement.population <= 3000), villages.map((m) => m.settlement.name_bg).join(", "));
});

test("cold_tolerance: prefer_mild ranks warmer winters higher than love_winter", () => {
  const jan = (ms) => ms.slice(0, 10).reduce((s, m) => s + fact(m.ekatte, "jan_mean_temp_c").value, 0) / 10;
  const mild = jan(all({ cold_tolerance: "prefer_mild", priorities: ["nature"] }).matches);
  const cold = jan(all({ cold_tolerance: "love_winter", priorities: ["nature"] }).matches);
  assert.ok(mild > cold + 1, `mild ${mild} vs cold ${cold}`);
});

test("buying: housing is scored from the purchase budget", () => {
  const d = all({ housing: "buy", buy_budget_eur: 120000, home_type: "house" }).matches[0].dimensions.find((x) => x.key === "housing");
  assert.ok(d && d.evidence.some((id) => id.endsWith(":house_sale_eur")));
});

test("new answers are validated", () => {
  const bad = engine.rank({ place_type: "castle", office_days: 9, pets: "yes" });
  assert.equal(bad.ok, false);
  assert.ok(["place_type", "office_days", "pets"].every((k) => bad.errors.some((e) => e.startsWith(k))));
});

// ---------- launch readiness ----------

test("English: hooks and the simulation/plan speak English when asked", async () => {
  const { buildPlan, buildSimulation } = await import("../src/narratives.js");
  const en = all({}, { lang: "en" }).matches[0].settlement.hook;
  const bg = all({}).matches[0].settlement.hook;
  assert.match(en, /people/);
  assert.match(bg, /жители/);
  const s = data.settlements.find((x) => x.name_bg === "Трявна");
  assert.equal(buildSimulation(s, {}, "en").scenes[0].title, "Morning");
  assert.match(buildPlan(s, {}, "en").sections[0].items[0].text, /EUR\/month/);
  assert.equal(buildSimulation(s, {}).scenes[0].title, "Сутрин");
});
