// Demo: run the sample personas (or your own answers JSON) through the engine.
//   npm run match                         → all personas against MongoDB Atlas, top 5 each
//   npm run match -- young_jobseeker      → one persona
//   npm run match -- --answers my.json    → your own ProfileAnswers
//   npm run match -- --offline            → use data/processed/settlements_enriched.json instead of MongoDB
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createEngine } from "../src/engine/index.js";
import { PERSONAS } from "./personas.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { answers: { type: "string" }, offline: { type: "boolean", default: false }, top: { type: "string", default: "5" } },
});

const settlements = values.offline
  ? JSON.parse(readFileSync(new URL("../../../data/processed/settlements_enriched.json", import.meta.url), "utf8")).settlements
  : await (await import("../src/db.js")).loadSettlements();
const engine = createEngine(settlements);

const runs = values.answers
  ? [["custom", { label: values.answers, answers: JSON.parse(readFileSync(values.answers, "utf8")) }]]
  : Object.entries(PERSONAS).filter(([k]) => !positionals.length || positionals.includes(k));

const pct = (x) => `${Math.round(x * 100)}%`;
for (const [key, persona] of runs) {
  const res = engine.rank(persona.answers, { limit: Number(values.top) });
  console.log(`\n=== ${key}: ${persona.label}`);
  if (!res.ok) {
    console.log("  Грешки:", res.errors.join("; "));
    continue;
  }
  console.log(`  Тежести: ${Object.entries(res.weights).map(([k, w]) => `${k} ${pct(w)}`).join(", ")}`);
  res.matches.forEach((m, i) => {
    const flag = m.passes_constraints ? "" : " ✗ ИЗКЛЮЧЕНО";
    console.log(`\n  ${i + 1}. ${m.settlement.name_bg} (${m.settlement.type}, обл. ${m.settlement.district}) · ${pct(m.score)} · увереност ${pct(m.confidence)}${flag}`);
    console.log(`     ${m.settlement.hook}`);
    console.log(`     ${m.dimensions.map((d) => `${d.key} ${d.score ?? "—"}`).join(" | ")}`);
    for (const r of m.reasons) console.log(`     + ${r.text}`);
    for (const t of m.tradeoffs) console.log(`     − ${t.text}`);
    for (const e of m.excluded_because) console.log(`     ✗ ${e.text}`);
    if (m.unknowns.length) console.log(`     ? ${m.unknowns.map((u) => `${u.dimension}: ${u.missing.join(", ")}`).join("; ")}`);
  });
}
