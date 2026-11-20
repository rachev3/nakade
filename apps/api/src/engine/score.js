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
  const pt = a.public_transport;
  const parts = [
    ["drive_min_to_oblast_centre", 0.35, (m) => lower(m, 10, 60)],
    ["bus_stop_nearest_km", pt === "daily" ? 0.5 : !car || pt === "sometimes" ? 0.35 : 0.2, (km) => lower(km, 0.3, 3)],
    ["train_station_nearest_km", pt === "daily" ? 0.35 : 0.2, (km) => lower(km, 1, 20)],
  ];
  if ((a.work_mode === "office" || a.work_mode === "hybrid") && a.max_commute_min != null) {
    // The job is assumed to stay where the user lives now; without a current location, in the oblast centre.
    // Fewer office days → a longer drive is still acceptable (up to 3× the stated limit at 1–2 days a week).
    const max = Math.max(a.max_commute_min, 5);
    const days = a.work_mode === "office" ? 5 : (a.office_days ?? 2);
    const target = F.v("drive_min_to_current_location") != null ? "drive_min_to_current_location" : "drive_min_to_oblast_centre";
    parts.push([target, 0.6, (m) => lower(m, max, max * (days <= 2 ? 3 : days <= 3 ? 2.5 : 2))]);
  }
  if (a.sofia_trips === "weekly" || a.sofia_trips === "monthly")
    parts.push(["drive_min_to_sofia", a.sofia_trips === "weekly" ? 0.4 : 0.2, (m) => lower(m, 30, a.sofia_trips === "weekly" ? 150 : 300)]);
  if (a.visit_home === "weekly" || a.visit_home === "monthly")
    parts.push(["drive_min_to_current_location", a.visit_home === "weekly" ? 0.4 : 0.2, (m) => lower(m, 45, a.visit_home === "weekly" ? 180 : 360)]);
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

// Download speed (Mbps) at which the need is not met at all / fully met.
const INTERNET = { basic: [3, 10], video_calls: [10, 30], heavy: [30, 100] };

function amenities(F, a) {
  const car = a.has_car !== false;
  // walkable: everyday places within ~300 m count fully, nothing beyond 2 km
  const near = (good, bad) => (km) => (a.walkable ? lower(km, 0.3, 2) : car ? lower(km, good * 2, bad * 2) : lower(km, good, bad));
  const out = a.going_out === "often" ? 0.3 : a.going_out === "sometimes" ? 0.15 : 0;
  const parts = [
    ["shop_nearest_km", 0.3, near(0.3, 5)],
    ["post_office_nearest_km", 0.15, near(0.5, 8)],
    ["food_drink_nearest_km", 0.15, near(0.3, 6)],
    ["culture_nearest_km", 0.1, near(0.5, 10)],
  ];
  if (a.walkable) parts.push(["pharmacy_nearest_km", 0.15, near(0.3, 5)]);
  if (out) {
    parts.push(["food_drink_count", out / 2, (n) => higher(n, 0, a.going_out === "often" ? 30 : 8)]);
    parts.push(["culture_count", out / 2, (n) => higher(n, 0, a.going_out === "often" ? 10 : 3)]);
  }
  if (a.pets) parts.push(["vet_nearest_km", 0.15, (km) => (car ? lower(km, 2, 25) : lower(km, 0.5, 5))]);
  const res = combine(F, parts);
  const w0 = parts.filter(([m]) => res.used.includes(m)).reduce((s, p) => s + p[1], 0);

  // Internet: the better of fixed and mobile, against what the user needs.
  const net = a.work_mode === "remote" || a.work_mode === "self_employed" || a.internet_needs ? 0.5 : 0.25;
  const [bad, good] = INTERNET[a.internet_needs] ?? [10, 100];
  const fixed = F.v("internet_fixed_down_mbps");
  const mobile = F.v("internet_mobile_down_mbps");
  const best = Math.max(fixed ?? -1, mobile ?? -1);
  if (best >= 0) {
    const s = higher(best, bad, good);
    res.score = res.score == null ? s : (res.score * w0 + s * net) / (w0 + net);
    res.used.push(...(fixed != null ? ["internet_fixed_down_mbps"] : []), ...(mobile != null ? ["internet_mobile_down_mbps"] : []));
  } else res.missing.push("internet_fixed_down_mbps", "internet_mobile_down_mbps");
  return res;
}

function nature(F, a) {
  const prefs = (a.nature ?? []).filter((p) => p !== "sea");
  const missingExtra = (a.nature ?? []).includes("sea") ? ["sea_distance_km"] : []; // no data for the coast yet
  const parts = [];
  if (!prefs.length) {
    parts.push(
      ["forest_share_pct", 0.35, (p) => higher(p, 5, 40)],
      ["forest_nearest_km", 0.2, (km) => lower(km, 0.5, 8)],
      ["water_nearest_km", 0.2, (km) => lower(km, 0.5, 8)],
      ["protected_nearest_km", 0.25, (km) => lower(km, 1, 15)],
    );
  }
  for (const p of prefs) {
    if (p === "mountains") parts.push(["elevation_m", 1, (m) => higher(m, 250, 800)]);
    if (p === "plains") parts.push(["elevation_m", 1, (m) => lower(m, 200, 600)]);
    if (p === "forest") {
      parts.push(["forest_share_pct", 0.5, (x) => higher(x, 5, 40)]);
      parts.push(["forest_nearest_km", 0.5, (km) => lower(km, 0.5, 8)]);
    }
    if (p === "water") parts.push(["water_nearest_km", 1, (km) => lower(km, 0.5, 8)]);
  }
  // Climate (Open-Meteo): mean January temperature and heating need vs Sofia (= 100).
  if (a.cold_tolerance === "prefer_mild") parts.push(["jan_mean_temp_c", 0.6, (t) => higher(t, -2, 3)]);
  if (a.cold_tolerance === "love_winter") parts.push(["jan_mean_temp_c", 0.6, (t) => lower(t, -3, 1)]);
  if (a.heating_costs) parts.push(["heating_vs_sofia_pct", 0.5, (p) => lower(p, 75, 110)]);
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

// Population range that fits each place type.
const PLACE_TYPE = { village: [0, 3000], small_town: [3000, 30000], city: [30000, Infinity] };

function demographics(F, a) {
  const parts = [["population_trend_pct", 0.6, (t) => higher(t, -30, 10)]];
  if (a.community === "quiet") parts.push(["population_2021", 0.4, (p) => 1 - logHigher(p, 1000, 200000)]);
  if (a.community === "lively") parts.push(["population_2021", 0.4, (p) => logHigher(p, 1000, 200000)]);
  if (PLACE_TYPE[a.place_type]) {
    const [min, max] = PLACE_TYPE[a.place_type];
    // inside the range → 1; one order of magnitude outside → 0
    const fit = (p) => (p >= min && p <= max ? 1 : Math.max(0, 1 - Math.abs(Math.log10(Math.max(p, 1)) - Math.log10(p < min ? min : max))));
    parts.push(["population_2021", 0.8, fit]);
  }
  return combine(F, parts);
}

const APARTMENT_M2 = 65; // a typical 2-room flat, to turn EUR/m² into a price

function housing(F, a) {
  if (a.housing === "buy") {
    if (a.buy_budget_eur == null) return { score: null, used: [], missing: [] };
    const fit = (price) => higher(a.buy_budget_eur / price, 0.6, 1.1);
    const parts = [];
    if (a.home_type !== "apartment") parts.push(["house_sale_eur", 1, fit]);
    if (a.home_type !== "house") parts.push(["apartment_sale_eur_m2", 1, (m2) => fit(m2 * APARTMENT_M2)]);
    const r = combine(F, parts);
    if (a.home_type !== "house" && a.home_type !== "apartment") {
      // either: the better of the two options counts
      const scores = parts.map(([m, , fn]) => (F.v(m) == null ? null : fn(F.v(m)))).filter((x) => x != null);
      if (scores.length) r.score = Math.max(...scores);
    }
    return r;
  }
  if (a.budget_eur_month == null) return { score: null, used: [], missing: [] };
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

/** Hard limit from `max_home_distance`: drive time to the current location. */
export const HOME_DISTANCE_MIN = { up_to_1h: 60, up_to_2h: 120, up_to_4h: 240 };
