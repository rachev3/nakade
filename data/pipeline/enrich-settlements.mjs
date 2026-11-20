// Enrich the pilot dataset (data/processed/settlements.json, built by build_dataset.py) with
// census population, municipal unemployment and housing prices, and express everything as
// Fact records in the shape of the API contract (apps/web/src/api/openapi.yaml → Fact).
//
//   node data/pipeline/enrich-settlements.mjs
//
// Inputs
//   data/processed/settlements.json            pilot: 30 cities + 60 nearby (OSM, OSRM, Ookla, Open-Meteo)
//   csv/data/manual/population_census.csv      НСИ census 2011/2021 by EKATTE
//   csv/data/manual/labour_by_municipality.csv Агенция по заетостта 2025 by municipality code
//   csv/data/raw/terramap_*.json               property listings (terramap.bg)
//   csv/data/out/places.json                   oblast centres with EKATTE (possible origins)
// Output
//   data/processed/settlements_enriched.json

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CSV = join(ROOT, "csv", "data");
const OUT = join(ROOT, "data", "processed", "settlements_enriched.json");
const RETRIEVED_AT = "2026-11-20";
const MIN_LISTINGS = 5; // fewer listings than this → no median

const SOURCES = {
  osm: { id: "osm", name: "OpenStreetMap", url: "https://www.openstreetmap.org", licence: "ODbL" },
  osrm: { id: "osrm", name: "OSRM, маршрути с кола върху OpenStreetMap", url: "https://project-osrm.org", licence: "ODbL" },
  ookla: { id: "ookla", name: "Ookla Open Data (измервания на скорост)", url: "https://github.com/teamookla/ookla-open-data", licence: "CC BY-NC-SA 4.0" },
  open_meteo: { id: "open_meteo", name: "Open-Meteo", url: "https://open-meteo.com", licence: "CC BY 4.0" },
  nsi_census: { id: "nsi_census", name: "НСИ, преброяване 2011 и 2021", url: "https://www.nsi.bg", licence: null },
  az: { id: "az", name: "Агенция по заетостта, годишни данни 2025", url: "https://www.az.government.bg", licence: null },
  terramap: { id: "terramap", name: "terramap.bg, обяви за имоти", url: "https://terramap.bg", licence: null },
};

const OSM_METHOD = "Разстояние по права линия до най-близкия обект в OpenStreetMap. Ако обект липсва в OSM, това не доказва, че го няма.";
const OSM_COUNT_METHOD = "Брой обекти в OpenStreetMap в землището на мястото (или в радиус, ако няма землище).";

// ---------- helpers ----------

function readCsv(path) {
  const lines = readFileSync(path, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",");
  return lines.slice(1).map((l) => Object.fromEntries(l.split(",").map((v, i) => [header[i], v])));
}
const num = (v) => (v === "" || v == null ? null : Number(v));
const median = (xs) => {
  if (xs.length < MIN_LISTINGS) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---------- inputs ----------

const pilot = JSON.parse(readFileSync(join(ROOT, "data", "processed", "settlements.json"), "utf8"));
const census = new Map(readCsv(join(CSV, "manual", "population_census.csv")).map((r) => [r.ekatte, r]));
const labour = new Map(readCsv(join(CSV, "manual", "labour_by_municipality.csv")).map((r) => [r.municipality_code, r]));

// Housing medians per city name, from the listings.
const listingsByCity = new Map();
for (const f of readdirSync(join(CSV, "raw")).filter((f) => f.startsWith("terramap_") && f !== "terramap_clusters.json")) {
  for (const x of JSON.parse(readFileSync(join(CSV, "raw", f), "utf8"))) {
    if (!listingsByCity.has(x.c)) listingsByCity.set(x.c, []);
    listingsByCity.get(x.c).push(x);
  }
}
function housingFor(city) {
  const L = listingsByCity.get(city) ?? [];
  const rent2 = L.filter((x) => x.t === "apartment" && x.tx === "rent" && x.r === 2 && x.p > 0).map((x) => x.p);
  const aptM2 = L.filter((x) => x.t === "apartment" && x.tx === "sale" && x.ppm > 0).map((x) => x.ppm);
  const house = L.filter((x) => x.t === "house" && x.tx === "sale" && x.p > 0).map((x) => x.p);
  return {
    rent_2room_eur_month: { value: median(rent2), n: rent2.length },
    apartment_sale_eur_m2: { value: median(aptM2), n: aptM2.length },
    house_sale_eur: { value: median(house), n: house.length },
  };
}

const origins = JSON.parse(readFileSync(join(CSV, "out", "places.json"), "utf8"))
  .filter((p) => p.origin_kind === "oblast_center" && p.ekatte)
  .map((p) => ({ ekatte: p.ekatte, name: p.name, lat: p.lat, lon: p.lon }))
  .sort((a, b) => a.name.localeCompare(b.name, "bg"));

// ---------- build ----------

function factBuilder(ekatte) {
  const facts = [];
  const add = (dimension, metric, value, unit, status, source, method = null) =>
    facts.push({
      id: `${ekatte}:${metric}`,
      ekatte,
      dimension,
      metric,
      value: value ?? null,
      unit,
      status,
      method,
      source: SOURCES[source],
      retrieved_at: RETRIEVED_AT,
    });
  return { facts, add };
}

const settlements = pilot.settlements.map((s) => {
  const { facts, add } = factBuilder(s.ekatte);
  const c = census.get(s.ekatte);
  const lab = labour.get(s.municipality_code);
  const pop2021 = num(c?.pop_2021);
  const pop2011 = num(c?.pop_2011);
  const trend = pop2011 > 0 && pop2021 != null ? Math.round(((pop2021 - pop2011) / pop2011) * 1000) / 10 : null;

  // transport
  add("transport", "drive_min_to_oblast_centre", s.drive_min_to_oblast_centre, "min", "derived", "osrm", `Време с кола до ${s.oblast_centre} по маршрут от OSRM.`);
  add("transport", "drive_km_to_oblast_centre", s.drive_km_to_oblast_centre, "km", "derived", "osrm");
  add("transport", "drive_min_to_sofia", s.drive_to_oblast_centres?.["София"]?.min ?? (s.name === "София" ? 0 : null), "min", "derived", "osrm", "Време с кола до София по маршрут от OSRM.");
  add("transport", "bus_stop_nearest_km", s.bus_stop_nearest_km, "km", "derived", "osm", OSM_METHOD);
  add("transport", "bus_stop_count", s.bus_stop_count, "count", "derived", "osm", OSM_COUNT_METHOD);
  add("transport", "train_station_nearest_km", s.train_station_nearest_km, "km", "derived", "osm", OSM_METHOD);
  add("transport", "train_station_count", s.train_station_count, "count", "derived", "osm", OSM_COUNT_METHOD);

  // healthcare
  for (const k of ["hospital", "doctor", "pharmacy"]) {
    add("healthcare", `${k}_nearest_km`, s[`${k}_nearest_km`], "km", "derived", "osm", OSM_METHOD);
    add("healthcare", `${k}_count`, s[`${k}_count`], "count", "derived", "osm", OSM_COUNT_METHOD);
  }
  // education
  for (const k of ["school", "kindergarten"]) {
    add("education", `${k}_nearest_km`, s[`${k}_nearest_km`], "km", "derived", "osm", OSM_METHOD);
    add("education", `${k}_count`, s[`${k}_count`], "count", "derived", "osm", OSM_COUNT_METHOD);
  }
  // amenities
  for (const k of ["shop", "post_office", "food_drink", "culture", "vet"]) {
    add("amenities", `${k}_nearest_km`, s[`${k}_nearest_km`], "km", "derived", "osm", OSM_METHOD);
    add("amenities", `${k}_count`, s[`${k}_count`], "count", "derived", "osm", OSM_COUNT_METHOD);
  }
  for (const k of ["fixed", "mobile"]) {
    const basis = s[`internet_${k}_basis`];
    const exact = basis === "settlement_area";
    add(
      "amenities",
      `internet_${k}_down_mbps`,
      s[`internet_${k}_down_mbps`],
      "Mbps",
      exact ? "verified" : "derived",
      "ookla",
      exact ? `Медиана от ${s[`internet_${k}_tests`]} теста в района на мястото.` : `Няма тестове в самото място; взети са най-близките до 3 км (${basis}).`,
    );
  }

  // nature
  add("nature", "forest_share_pct", s.forest_share_pct, "%", "derived", "osm", "Дял на горите в землището по OSM.");
  for (const k of ["forest", "water", "protected"]) add("nature", `${k}_nearest_km`, s[`${k}_nearest_km`], "km", "derived", "osm", OSM_METHOD);
  add("nature", "elevation_m", s.elevation_m, "m", "verified", "open_meteo");
  add("nature", "jan_mean_temp_c", s.jan_mean_temp_c, "°C", "verified", "open_meteo", "Средна януарска температура, 2024–2026.");
  add("nature", "heating_vs_sofia_pct", s.heating_vs_sofia_pct, "%", "derived", "open_meteo", "Нужда от отопление (градусо-дни) спрямо София = 100.");

  // employment
  add("employment", "unemployment_rate_pct", num(lab?.unemployment_rate_2025), "%", "verified", "az", `Средногодишна безработица в ${lab?.municipality ?? s.municipality}, 2025.`);
  add("employment", "unemployment_change_pp", num(lab?.unemployment_change_pp), "pp", "verified", "az", "Промяна спрямо 2024 г.");
  add("employment", "vacancies_per_100_unemployed", num(lab?.oblast_vacancies_per_100_unemployed), "per 100", "derived", "az", `Обявени работни места на 100 безработни в обл. ${lab?.oblast ?? s.oblast}, 2025.`);

  // demographics
  add("demographics", "population_2021", pop2021, "people", "verified", "nsi_census");
  add("demographics", "population_2011", pop2011, "people", "verified", "nsi_census");
  add("demographics", "population_trend_pct", trend, "%", "derived", "nsi_census", "Промяна на населението 2011 → 2021.");

  // housing (city listings; nearby places and cities without listings get the oblast centre's numbers as an estimate)
  const own = housingFor(s.name);
  const ref = s.role === "city" ? s.name : s.parent_city;
  const parent = housingFor(ref);
  const fallback = housingFor(s.oblast_centre);
  for (const [metric, unit] of [["rent_2room_eur_month", "EUR/month"], ["apartment_sale_eur_m2", "EUR/m²"], ["house_sale_eur", "EUR"]]) {
    if (own[metric].value != null) {
      add("housing", metric, own[metric].value, unit, "derived", "terramap", `Медиана от ${own[metric].n} обяви в ${s.name}.`);
    } else {
      const [src, from] = parent[metric].value != null ? [parent, ref] : [fallback, s.oblast_centre];
      add("housing", metric, src[metric].value, unit, "estimated", "terramap",
        src[metric].value == null ? `Няма достатъчно обяви за ${s.name}.` : `Няма обяви за ${s.name}; взета е медианата за ${from} (${src[metric].n} обяви).`);
    }
  }

  return {
    ekatte: s.ekatte,
    name_bg: s.name,
    name_en: s.name_en,
    type: s.type === "село" ? "village" : "town",
    osm_place: s.osm_place,
    role: s.role,
    parent_city: s.parent_city,
    parent_town_ekatte: null, // filled below
    municipality: s.municipality,
    municipality_code: s.municipality_code,
    district: s.oblast,
    oblast_centre: s.oblast_centre,
    lat: s.lat,
    lon: s.lon,
    population: pop2021 ?? s.population_osm ?? null,
    drive_to_oblast_centres: s.drive_to_oblast_centres ?? {},
    facts,
  };
});

const cityEkatte = new Map(settlements.filter((s) => s.role === "city").map((s) => [s.name_bg, s.ekatte]));
for (const s of settlements) if (s.role !== "city") s.parent_town_ekatte = cityEkatte.get(s.parent_city) ?? null;

writeFileSync(
  OUT,
  JSON.stringify({ generated: RETRIEVED_AT, sources: Object.values(SOURCES), origins, settlements }) + "\n",
);

const nullFacts = settlements.flatMap((s) => s.facts).filter((f) => f.value == null);
console.log(`Wrote ${settlements.length} settlements, ${origins.length} origins → ${OUT}`);
console.log(`Facts: ${settlements.reduce((n, s) => n + s.facts.length, 0)}, without value: ${nullFacts.length}`);
const byMetric = {};
for (const f of nullFacts) byMetric[f.metric] = (byMetric[f.metric] ?? 0) + 1;
console.log("Missing by metric:", byMetric);
