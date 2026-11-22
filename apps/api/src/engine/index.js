// Matching engine: ProfileAnswers + the 90 pilot settlements → ranked Match objects in the shape of
// the API contract (apps/web/src/api/openapi.yaml). Deterministic and pure: no DB, no LLM, no randomness.

import { DIMENSIONS, HOUSING, validateAnswers, weightsFor } from "./answers.js";
import { SCORERS, MUST_HAVES, HOME_DISTANCE_MIN } from "./score.js";
import { ORIGINS } from "./origins.js";

export { DIMENSIONS, validateAnswers, weightsFor, ORIGINS };

const NATIONAL_UNEMPLOYMENT_2025 = 5.27; // Агенция по заетостта, „Средно за страната“ 2025
const STATUS_CONFIDENCE = { verified: 1, derived: 0.85, estimated: 0.5 };
const MUST_HAVE_DIMENSION = {
  hospital_30min: "healthcare",
  pharmacy: "healthcare",
  school: "education",
  kindergarten: "education",
  train_to_sofia: "transport",
  fast_internet: "amenities",
};

const r3 = (x) => Math.round(x * 1000) / 1000;
const fmt = (n, digits = 1) => (n == null ? "?" : Number(n).toLocaleString("bg-BG", { maximumFractionDigits: digits }));

/** Fact accessor for one settlement (+ request-specific extra facts). */
function factsOf(s, extra = []) {
  const byMetric = new Map([...s.facts, ...extra].map((f) => [f.metric, f]));
  return {
    f: (m) => byMetric.get(m) ?? null,
    v: (m) => byMetric.get(m)?.value ?? null,
    id: (m) => byMetric.get(m)?.id ?? `${s.ekatte}:${m}`,
  };
}

/**
 * @param {object[]} settlements docs from the `settlements` collection (or data/processed/settlements_enriched.json)
 */
export function createEngine(settlements) {
  const all = settlements.map(({ _id, location, imported_at, ...s }) => s);
  const byEkatte = new Map(all.map((s) => [s.ekatte, s]));
  // English names of the oblast centres, for English hooks (a centre outside the pilot keeps its Bulgarian name).
  const nameEn = new Map(all.map((s) => [s.name_bg, s.name_en]));
  const knownEkatte = new Set([...ORIGINS.map((o) => o.ekatte), ...byEkatte.keys()]);

  /** current_location → { name, via } where `via` is the oblast centre the drive time is taken to. */
  function resolveOrigin(ekatte) {
    if (!ekatte) return null;
    const o = ORIGINS.find((x) => x.ekatte === ekatte);
    if (o) return { ekatte, name: o.name, via: o.name, exact: true };
    const s = byEkatte.get(ekatte);
    if (!s) return null;
    const isCentre = ORIGINS.some((x) => x.name === s.name_bg);
    return { ekatte, name: s.name_bg, via: isCentre ? s.name_bg : s.oblast_centre, exact: isCentre };
  }

  function originFact(s, origin) {
    if (!origin) return null;
    const isSelf = s.ekatte === origin.ekatte;
    const d = s.drive_to_oblast_centres?.[origin.via];
    const min = isSelf ? 0 : s.name_bg === origin.via ? 0 : d?.min ?? null;
    return {
      id: `${s.ekatte}:drive_min_to_current_location`,
      ekatte: s.ekatte,
      dimension: "transport",
      metric: "drive_min_to_current_location",
      value: min,
      unit: "min",
      status: origin.exact ? "derived" : "estimated",
      method: origin.exact
        ? `Време с кола до ${origin.name} по маршрут от OSRM.`
        : `Време с кола до ${origin.via} (областния град на ${origin.name}), не до самото място.`,
      source: { id: "osrm", name: "OSRM, маршрути с кола върху OpenStreetMap", url: "https://project-osrm.org", licence: "ODbL" },
      retrieved_at: s.facts[0]?.retrieved_at ?? null,
    };
  }

  function scoreOne(s, a, weights, origin, lang) {
    const extra = [originFact(s, origin)].filter(Boolean);
    const F = factsOf(s, extra);
    const ctx = { s, a, F, origin };

    const dimensions = [];
    const unknowns = [];
    let sum = 0;
    let wKnown = 0;
    let conf = 0;
    let wAll = 0;
    for (const [key, weight] of Object.entries(weights)) {
      if (weight <= 0) continue;
      const res = SCORERS[key](F, a);
      const used = [...new Set(res.used)];
      const evidence = used.map(F.id);
      if (key === "transport" && extra.length && extra[0].value != null) evidence.push(extra[0].id);
      dimensions.push({ key, score: res.score == null ? null : r3(res.score), weight, evidence });
      if (res.missing.length && weight >= 0.03) unknowns.push({ dimension: key, missing: [...new Set(res.missing)] });
      wAll += weight;
      if (res.score != null) {
        sum += res.score * weight;
        wKnown += weight;
        const c = used.reduce((x, m) => x + (STATUS_CONFIDENCE[F.f(m)?.status] ?? 0.5), 0) / (used.length || 1);
        conf += c * weight;
      }
    }

    const excluded_because = [];
    for (const mh of a.must_haves ?? []) {
      const rule = MUST_HAVES[mh];
      const ok = rule.check(F);
      if (ok === false) excluded_because.push(constraintText(mh, ctx));
      if (ok === null) unknowns.push({ dimension: MUST_HAVE_DIMENSION[mh], missing: rule.metrics });
    }
    const homeLimit = HOME_DISTANCE_MIN[a.max_home_distance];
    const homeMin = F.v("drive_min_to_current_location");
    if (homeLimit && homeMin != null && homeMin > homeLimit)
      excluded_because.push({
        text_key: "constraint.max_home_distance",
        params: { drive_min: homeMin, limit_min: homeLimit, origin: origin?.name },
        fact_ids: [F.id("drive_min_to_current_location")],
        text: `На ${fmt(homeMin)} мин с кола от ${origin?.name}, а лимитът ти е ${homeLimit / 60} ч.`,
      });
    if ((a.must_haves ?? []).includes("train_to_sofia") && excluded_because.every((e) => e.text_key !== "constraint.train_to_sofia"))
      unknowns.push({ dimension: "transport", missing: ["train_lines_to_sofia"] }); // a station nearby does not prove a line to Sofia

    const { reasons, tradeoffs } = explain(dimensions, ctx);
    return {
      ekatte: s.ekatte,
      settlement: summary(s, F, lang, nameEn),
      score: r3(wKnown ? sum / wKnown : 0),
      confidence: r3(wAll ? conf / wAll : 0),
      passes_constraints: excluded_because.length === 0,
      excluded_because,
      dimensions,
      reasons,
      tradeoffs,
      unknowns,
      facts: extra, // request-specific facts (drive time to the user's current location)
    };
  }

  /**
   * @param {object} answers ProfileAnswers
   * @param {{ ekatte?: string[], type?: "town"|"village", limit?: number }} request MatchRequest
   */
  function rank(answers = {}, request = {}) {
    const errors = validateAnswers(answers, { knownEkatte });
    if (errors.length) return { ok: false, errors };
    const { weights, trace } = weightsFor(answers);
    const origin = resolveOrigin(answers.current_location);

    let pool = all.filter((s) => s.ekatte !== answers.current_location);
    if (request.ekatte?.length) pool = pool.filter((s) => request.ekatte.includes(s.ekatte));
    if (request.type) pool = pool.filter((s) => s.type === request.type);

    const matches = pool
      .map((s) => scoreOne(s, answers, weights, origin, request.lang))
      .sort(
        (x, y) =>
          Number(y.passes_constraints) - Number(x.passes_constraints) ||
          y.score - x.score ||
          (y.settlement.population ?? 0) - (x.settlement.population ?? 0) ||
          x.ekatte.localeCompare(y.ekatte),
      );
    return { ok: true, weights, trace, origin, matches: matches.slice(0, request.limit ?? 20), total: matches.length };
  }

  return {
    rank,
    origins: () => ORIGINS,
    settlements: () => all,
    get: (ekatte) => byEkatte.get(ekatte) ?? null,
    summary: (s, lang = "bg") => summary(s, factsOf(s), lang, nameEn),
  };
}

// ---------- texts: built only from facts; text_key/params follow the frontend i18n keys ----------

function summary(s, F, lang = "bg", nameEn = new Map()) {
  const pop = s.population;
  const centre = s.oblast_centre;
  const min = F.v("drive_min_to_oblast_centre");
  const isCentre = s.name_bg === centre;
  const en = (n) => (n == null ? "?" : Number(n).toLocaleString("en-GB"));
  const hook =
    lang === "en"
      ? isCentre
        ? `Oblast centre with ${en(pop)} people.`
        : `${s.type === "village" ? "Village" : "Town"} of ${en(pop)} people, ${en(min)} min by car from ${nameEn.get(centre) ?? centre}.`
      : isCentre
        ? `Областен град с ${fmt(pop)} жители.`
        : `${s.type === "village" ? "Село" : "Град"} с ${fmt(pop)} жители, на ${fmt(min)} мин с кола от ${centre}.`;
  return {
    ekatte: s.ekatte,
    name_bg: s.name_bg,
    name_en: s.name_en,
    type: s.type,
    municipality: s.municipality,
    district: s.district,
    lat: s.lat,
    lon: s.lon,
    parent_town_ekatte: s.parent_town_ekatte ?? null,
    population: pop,
    hook,
    image_url: null,
  };
}

const est = (F, m) => (F.f(m)?.status === "estimated" ? " (ориентир)" : "");

const TEXT = {
  transport({ s, F, origin }, good) {
    const min = F.v("drive_min_to_oblast_centre");
    const bus = F.v("bus_stop_nearest_km");
    const train = F.v("train_station_nearest_km");
    const params = { centre: s.oblast_centre, drive_min: min, bus_km: bus, train_km: train };
    let t =
      s.name_bg === s.oblast_centre
        ? `Областен град; най-близката спирка е на ${fmt(bus)} км, гара на ${fmt(train)} км.`
        : `${fmt(min)} мин с кола до ${s.oblast_centre}; спирка на ${fmt(bus)} км, гара на ${fmt(train)} км.`;
    const o = F.f("drive_min_to_current_location");
    const sameAsCentre = origin?.exact && origin.name === s.oblast_centre && s.name_bg !== s.oblast_centre;
    if (o?.value != null && !sameAsCentre) {
      t += ` До ${origin.name}: ${fmt(o.value)} мин${o.status === "estimated" ? " (през областния град)" : ""}.`;
      params.origin = origin.name;
      params.origin_min = o.value;
    }
    return { t, params, good };
  },
  healthcare({ F }) {
    const [h, d, p] = ["hospital_nearest_km", "doctor_nearest_km", "pharmacy_nearest_km"].map(F.v);
    return { t: `Болница на ${fmt(h)} км, лекар на ${fmt(d)} км, аптека на ${fmt(p)} км.`, params: { hospital_km: h, doctor_km: d, pharmacy_km: p } };
  },
  education({ F, a }) {
    const kg = F.v("kindergarten_nearest_km");
    const sc = F.v("school_nearest_km");
    const ages = a.kids_ages ?? [];
    const parts = [];
    if (!ages.length || ages.some((x) => x < 7)) parts.push(`детска градина на ${fmt(kg)} км`);
    if (!ages.length || ages.some((x) => x >= 7)) parts.push(`училище на ${fmt(sc)} км`);
    const t = parts.join(", ");
    return { t: t[0].toUpperCase() + t.slice(1) + ".", params: { kindergarten_km: kg, school_km: sc } };
  },
  amenities({ F }) {
    const shop = F.v("shop_nearest_km");
    const net = Math.max(F.v("internet_fixed_down_mbps") ?? -1, F.v("internet_mobile_down_mbps") ?? -1);
    const netText = net >= 0 ? `; интернет около ${fmt(Math.round(net))} Mbps` : "";
    return { t: `Магазин на ${fmt(shop)} км${netText}.`, params: { shop_km: shop, internet_mbps: net >= 0 ? Math.round(net) : null } };
  },
  nature({ F }) {
    const forest = F.v("forest_share_pct");
    const elev = F.v("elevation_m");
    const water = F.v("water_nearest_km");
    return { t: `${fmt(forest)}% гори в землището, вода на ${fmt(water)} км, надморска височина ${fmt(elev)} м.`, params: { forest_pct: forest, water_km: water, elevation_m: elev } };
  },
  employment({ s, F }) {
    const u = F.v("unemployment_rate_pct");
    const cmp = u <= NATIONAL_UNEMPLOYMENT_2025 ? "под" : "над";
    return {
      t: `Безработица ${fmt(u, 2)}% в община ${s.municipality} (${cmp} средното за страната ${fmt(NATIONAL_UNEMPLOYMENT_2025, 2)}%).`,
      params: { unemployment_pct: u, national_pct: NATIONAL_UNEMPLOYMENT_2025, municipality: s.municipality },
    };
  },
  demographics({ F }) {
    const t = F.v("population_trend_pct");
    const pop = F.v("population_2021");
    const dir = t >= 0 ? `се е увеличило с ${fmt(t)}%` : `е намаляло с ${fmt(Math.abs(t))}%`;
    return { t: `Населението ${dir} между 2011 и 2021 г. (${fmt(pop)} души).`, params: { trend_pct: t, population: pop } };
  },
  housing({ F, a }) {
    const rent = F.v("rent_2room_eur_month");
    return {
      t: `Типичен наем на двустаен: ${fmt(rent)} EUR/месец${est(F, "rent_2room_eur_month")}; бюджетът ти е ${fmt(a.budget_eur_month)} EUR.`,
      params: { rent_eur: rent, budget_eur: a.budget_eur_month },
    };
  },
};

function explain(dimensions, ctx) {
  const good = [];
  const bad = [];
  for (const d of dimensions) {
    if (d.score == null) continue;
    const isGood = d.weight >= 0.08 && d.score >= 0.65;
    const isBad = (d.weight >= 0.08 && d.score <= 0.4) || (d.weight >= 0.04 && d.score <= 0.15);
    if (!isGood && !isBad) continue;
    const { t, params } = TEXT[d.key](ctx, isGood);
    const item = { text_key: `${isGood ? "reason" : "tradeoff"}.${d.key}`, params, fact_ids: d.evidence, text: t };
    (isGood ? good : bad).push([d.weight * (isGood ? d.score : 1 - d.score), item]);
  }
  const top = (xs) => xs.sort((x, y) => y[0] - x[0]).slice(0, 3).map(([, item]) => item);
  return { reasons: top(good), tradeoffs: top(bad) };
}

function constraintText(mh, { F }) {
  const km = (m) => fmt(F.v(m));
  const texts = {
    hospital_30min: `Най-близката болница е на ${km("hospital_nearest_km")} км по права линия (приемаме до 20 км за ~30 мин с кола).`,
    school: `Няма училище до 5 км (най-близкото е на ${km("school_nearest_km")} км).`,
    kindergarten: `Няма детска градина до 3 км (най-близката е на ${km("kindergarten_nearest_km")} км).`,
    pharmacy: `Няма аптека до 3 км (най-близката е на ${km("pharmacy_nearest_km")} км).`,
    train_to_sofia: `Няма жп гара до 5 км (най-близката е на ${km("train_station_nearest_km")} км).`,
    fast_internet: `Интернетът е под 50 Mbps (стационарен ${km("internet_fixed_down_mbps")}, мобилен ${km("internet_mobile_down_mbps")} Mbps).`,
  };
  const metrics = MUST_HAVES[mh].metrics;
  return {
    text_key: `constraint.${mh}`,
    params: Object.fromEntries(metrics.map((m) => [m, F.v(m)])),
    fact_ids: metrics.map(F.id),
    text: texts[mh],
  };
}
