// Dimension scorers and must-have checks. Every scorer only reads facts (by metric key) and returns
//   { score 0..1 | null, used: [metric], missing: [metric] }
// A metric without a value is listed in `missing` and left out; it never counts as 0 or as 1.

const clamp = (x) => Math.max(0, Math.min(1, x));
/** 1 at or below `good`, 0 at or above `bad`. */
export const lower = (x, good, bad) => clamp((bad - x) / (bad - good));
/** 0 at or below `bad`, 1 at or above `good`. */
export const higher = (x, bad, good) => clamp((x - bad) / (good - bad));
const logHigher = (x, bad, good) => higher(Math.log10(Math.max(x, 1)), Math.log10(bad), Math.log10(good));

/** Weighted mean over parts [metric, weight, fn(value)]; parts without data are skipped and reported. */
function combine(F, parts) {
  let s = 0;
  let w = 0;
  const used = [];
  const missing = [];
  for (const [metric, weight, fn] of parts) {
    const v = F.v(metric);
    if (v == null) {
      missing.push(metric);
      continue;
    }
    s += fn(v) * weight;
    w += weight;
    used.push(metric);
  }
  return { score: w ? s / w : null, used, missing };
}

function transport(F, a) {
  const car = a.has_car !== false;
  const parts = [
    ["drive_min_to_oblast_centre", 0.35, (m) => lower(m, 10, 60)],
    ["bus_stop_nearest_km", car ? 0.2 : 0.4, (km) => lower(km, 0.3, 3)],
    ["train_station_nearest_km", 0.2, (km) => lower(km, 1, 20)],
  ];
  if ((a.work_mode === "office" || a.work_mode === "hybrid") && a.max_commute_min != null) {
    // The job is assumed to stay where the user lives now; without a current location, in the oblast centre.
    // Hybrid workers commute less often, so they get twice the stated limit before the score drops to 0.
    const max = Math.max(a.max_commute_min, 5);
    const target = F.v("drive_min_to_current_location") != null ? "drive_min_to_current_location" : "drive_min_to_oblast_centre";
    parts.push([target, 0.6, (m) => lower(m, max, max * (a.work_mode === "hybrid" ? 3 : 2))]);
  }
  return combine(F, parts);
}

function healthcare(F, a) {
  const car = a.has_car !== false;
  const hospitalW = a.healthcare_needs === "specialist" ? 0.6 : 0.4;
  return combine(F, [
    ["hospital_nearest_km", hospitalW, (km) => (car ? lower(km, 3, 30) : lower(km, 1, 10))],
    ["doctor_nearest_km", 0.35, (km) => (car ? lower(km, 2, 15) : lower(km, 0.5, 4))],
    ["pharmacy_nearest_km", 0.25, (km) => (car ? lower(km, 2, 15) : lower(km, 0.5, 3))],
  ]);
}

function education(F, a) {
  const car = a.has_car !== false;
  const fn = (km) => (car ? lower(km, 1, 15) : lower(km, 0.5, 4));
  const ages = a.kids_ages ?? [];
  const needKg = ages.length ? ages.some((x) => x < 7) : true;
  const needSchool = ages.length ? ages.some((x) => x >= 7) : true;
  const parts = [];
  if (needKg) parts.push(["kindergarten_nearest_km", 1, fn]);
  if (needSchool) parts.push(["school_nearest_km", 1, fn]);
  return combine(F, parts);
}

function amenities(F, a) {
  const car = a.has_car !== false;
  const near = (good, bad) => (km) => (car ? lower(km, good * 2, bad * 2) : lower(km, good, bad));
  const net = a.work_mode === "remote" || a.work_mode === "self_employed" ? 0.5 : 0.25;
  const res = combine(F, [
    ["shop_nearest_km", 0.3, near(0.3, 5)],
    ["post_office_nearest_km", 0.15, near(0.5, 8)],
    ["food_drink_nearest_km", 0.15, near(0.3, 6)],
    ["culture_nearest_km", 0.1, near(0.5, 10)],
  ]);
  // Internet: the better of fixed and mobile.
  const fixed = F.v("internet_fixed_down_mbps");
  const mobile = F.v("internet_mobile_down_mbps");
  const best = Math.max(fixed ?? -1, mobile ?? -1);
  if (best >= 0) {
    const w0 = 0.7; // weight of the parts above
    res.score = res.score == null ? higher(best, 10, 100) : (res.score * w0 + higher(best, 10, 100) * net) / (w0 + net);
    res.used.push(...(fixed != null ? ["internet_fixed_down_mbps"] : []), ...(mobile != null ? ["internet_mobile_down_mbps"] : []));
  } else res.missing.push("internet_fixed_down_mbps", "internet_mobile_down_mbps");
  return res;
}

function nature(F, a) {
  const prefs = (a.nature ?? []).filter((p) => p !== "sea");
  const missingExtra = (a.nature ?? []).includes("sea") ? ["sea_distance_km"] : []; // no data for the coast yet
  if (!prefs.length) {
    const r = combine(F, [
      ["forest_share_pct", 0.35, (p) => higher(p, 5, 40)],
      ["forest_nearest_km", 0.2, (km) => lower(km, 0.5, 8)],
      ["water_nearest_km", 0.2, (km) => lower(km, 0.5, 8)],
      ["protected_nearest_km", 0.25, (km) => lower(km, 1, 15)],
    ]);
    r.missing.push(...missingExtra);
    return r;
  }
  const parts = [];
  for (const p of prefs) {
    if (p === "mountains") parts.push(["elevation_m", 1, (m) => higher(m, 250, 800)]);
    if (p === "plains") parts.push(["elevation_m", 1, (m) => lower(m, 200, 600)]);
    if (p === "forest") {
      parts.push(["forest_share_pct", 0.5, (x) => higher(x, 5, 40)]);
      parts.push(["forest_nearest_km", 0.5, (km) => lower(km, 0.5, 8)]);
    }
    if (p === "water") parts.push(["water_nearest_km", 1, (km) => lower(km, 0.5, 8)]);
  }
  const r = combine(F, parts);
  r.missing.push(...missingExtra);
  return r;
}

function employment(F) {
  return combine(F, [
    ["unemployment_rate_pct", 0.6, (u) => lower(u, 3, 15)],
    ["vacancies_per_100_unemployed", 0.4, (v) => higher(v, 20, 120)],
  ]);
}

function demographics(F, a) {
  const parts = [["population_trend_pct", 0.6, (t) => higher(t, -30, 10)]];
  if (a.community === "quiet") parts.push(["population_2021", 0.4, (p) => 1 - logHigher(p, 1000, 200000)]);
  if (a.community === "lively") parts.push(["population_2021", 0.4, (p) => logHigher(p, 1000, 200000)]);
  return combine(F, parts);
}

function housing(F, a) {
  if (a.budget_eur_month == null || a.housing === "buy") return { score: null, used: [], missing: [] };
  return combine(F, [["rent_2room_eur_month", 1, (rent) => higher(a.budget_eur_month / rent, 0.6, 1.2)]]);
}

export const SCORERS = { transport, healthcare, education, amenities, nature, employment, demographics, housing };

// ---------- must-haves: true = ok, false = fails, null = no data (passes, reported as unknown) ----------

const has = (F, count, nearest, km) => {
  const c = F.v(count);
  const d = F.v(nearest);
  if (c > 0) return true;
  if (d != null) return d <= km;
  return c == null ? null : false;
};

export const MUST_HAVES = {
  // Straight-line distance; ≤ 20 km is treated as "within ~30 min by car". Stated as an estimate in the UI text.
  hospital_30min: { metrics: ["hospital_nearest_km"], check: (F) => (F.v("hospital_nearest_km") == null ? null : F.v("hospital_nearest_km") <= 20) },
  school: { metrics: ["school_count", "school_nearest_km"], check: (F) => has(F, "school_count", "school_nearest_km", 5) },
  kindergarten: { metrics: ["kindergarten_count", "kindergarten_nearest_km"], check: (F) => has(F, "kindergarten_count", "kindergarten_nearest_km", 3) },
  pharmacy: { metrics: ["pharmacy_count", "pharmacy_nearest_km"], check: (F) => has(F, "pharmacy_count", "pharmacy_nearest_km", 3) },
  // We know where stations are, not which lines stop there.
  train_to_sofia: { metrics: ["train_station_nearest_km"], check: (F) => (F.v("train_station_nearest_km") == null ? null : F.v("train_station_nearest_km") <= 5) },
  fast_internet: {
    metrics: ["internet_fixed_down_mbps", "internet_mobile_down_mbps"],
    check: (F) => {
      const vals = [F.v("internet_fixed_down_mbps"), F.v("internet_mobile_down_mbps")].filter((x) => x != null);
      return vals.length ? Math.max(...vals) >= 50 : null;
    },
  },
};
