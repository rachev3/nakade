// ProfileAnswers as defined in the API contract (apps/web/src/api/openapi.yaml) and asked by the
// frontend onboarding (apps/web/src/features/onboarding/steps.ts). Validation + answers → weights.

export const DIMENSIONS = ["transport", "healthcare", "education", "amenities", "nature", "employment", "demographics"];
// `housing` is scored only when the user gives a budget. It is not in the contract's Dimension enum yet:
// proposed addition (see apps/api/ENGINE.md).
export const HOUSING = "housing";

const ENUMS = {
  household: ["single", "couple", "family_kids", "retired", "other"],
  work_mode: ["remote", "hybrid", "office", "self_employed", "looking", "not_working"],
  must_haves: ["hospital_30min", "school", "train_to_sofia", "fast_internet", "pharmacy", "kindergarten"],
  housing: ["rent", "buy", "undecided"],
  healthcare_needs: ["none", "regular", "specialist"],
  nature: ["mountains", "forest", "water", "sea", "plains"],
  community: ["quiet", "lively", "either"],
  // added with the 10 / 30 question onboarding
  max_home_distance: ["up_to_1h", "up_to_2h", "up_to_4h", "any"],
  place_type: ["village", "small_town", "city", "any"],
  home_type: ["house", "apartment", "either"],
  internet_needs: ["basic", "video_calls", "heavy"],
  public_transport: ["daily", "sometimes", "never"],
  sofia_trips: ["weekly", "monthly", "rarely"],
  visit_home: ["weekly", "monthly", "rarely"],
  cold_tolerance: ["love_winter", "fine", "prefer_mild"],
  going_out: ["often", "sometimes", "rarely"],
  depopulation: ["important", "somewhat", "not_important"],
};
const BOOLEANS = ["has_car", "partner_job", "walkable", "heating_costs", "pets"];

/** Returns a list of problems (empty = ok). All answers are optional (progressive profiling). */
export function validateAnswers(a = {}, { knownEkatte } = {}) {
  const errors = [];
  const one = (k) => a[k] == null || ENUMS[k].includes(a[k]) || errors.push(`${k}: invalid value "${a[k]}"`);
  const many = (k, allowed, max) => {
    if (a[k] == null) return;
    if (!Array.isArray(a[k])) return errors.push(`${k}: expected an array`);
    const bad = a[k].filter((v) => !allowed.includes(v));
    if (bad.length) errors.push(`${k}: invalid values ${bad.join(", ")}`);
    if (max && a[k].length > max) errors.push(`${k}: at most ${max}`);
  };
  const int = (k, min, max) =>
    a[k] == null || (Number.isInteger(a[k]) && a[k] >= min && a[k] <= max) || errors.push(`${k}: expected an integer ${min}..${max}`);

  for (const k of Object.keys(ENUMS)) if (!["must_haves", "nature"].includes(k)) one(k);
  for (const k of BOOLEANS) if (a[k] != null && typeof a[k] !== "boolean") errors.push(`${k}: expected a boolean`);
  int("buy_budget_eur", 0, 10000000);
  int("office_days", 0, 5);
  many("priorities", DIMENSIONS, 3);
  many("compromises", DIMENSIONS);
  many("must_haves", ENUMS.must_haves);
  many("nature", ENUMS.nature);
  if (a.kids_ages != null && (!Array.isArray(a.kids_ages) || a.kids_ages.some((x) => !Number.isInteger(x) || x < 0 || x > 18)))
    errors.push("kids_ages: expected integers 0..18");
  int("budget_eur_month", 0, 100000);
  int("max_commute_min", 0, 240);
  if (a.current_location != null && knownEkatte && !knownEkatte.has(a.current_location))
    errors.push(`current_location: unknown EKATTE ${a.current_location}`);
  return errors;
}

/**
 * Raw weights from the answers, then normalised to sum 1. Every rule is listed in `trace`
 * so the UI or a developer can see why a dimension matters.
 */
export function weightsFor(a = {}) {
  const w = Object.fromEntries(DIMENSIONS.map((d) => [d, 1]));
  const trace = [];
  const bump = (d, by, why) => {
    w[d] += by;
    trace.push(`${d} ${by > 0 ? "+" : ""}${by}: ${why}`);
  };
  const set = (d, to, why) => {
    w[d] = to;
    trace.push(`${d} = ${to}: ${why}`);
  };

  if (a.household === "family_kids" || a.kids_ages?.length) bump("education", 1.5, "деца");
  else set("education", 0.2, "без деца");
  if (a.household === "retired") {
    bump("healthcare", 1, "пенсионер");
    set("employment", 0, "пенсионер");
  }

  switch (a.work_mode) {
    case "remote":
      set("employment", 0.3, "дистанционна работа");
      bump("amenities", 0.5, "дистанционна работа → интернет");
      break;
    case "hybrid":
    case "office":
      bump("employment", 1, "работа в офис");
      bump("transport", 1, "пътуване до работа");
      break;
    case "self_employed":
      set("employment", 0.7, "собствен бизнес");
      bump("amenities", 0.3, "собствен бизнес → интернет");
      break;
    case "looking":
      bump("employment", 1.5, "търси работа");
      break;
    case "not_working":
      set("employment", 0.2, "не работи");
      break;
  }

  if (a.has_car === false) {
    bump("transport", 1.5, "без кола");
    bump("amenities", 0.5, "без кола → магазини пеша");
  }
  if (a.healthcare_needs === "regular") bump("healthcare", 1, "редовни медицински грижи");
  if (a.healthcare_needs === "specialist") bump("healthcare", 2, "нужда от специалисти");
  if (a.nature?.length) bump("nature", 1, "предпочитания за природа");

  // Detailed questions
  if (a.place_type && a.place_type !== "any") bump("demographics", 1, "предпочитан тип място");
  if (a.partner_job) bump("employment", 1, "партньорът търси работа");
  if (a.internet_needs === "heavy") bump("amenities", 0.5, "тежка работа в интернет");
  if (a.walkable) bump("amenities", 1, "всичко пеша");
  if (a.public_transport === "daily") bump("transport", 1.5, "всеки ден с обществен транспорт");
  if (a.public_transport === "sometimes") bump("transport", 0.5, "понякога с обществен транспорт");
  if (a.sofia_trips === "weekly") bump("transport", 1, "всяка седмица до София");
  if (a.sofia_trips === "monthly") bump("transport", 0.5, "всеки месец до София");
  if (a.visit_home === "weekly" && a.current_location) bump("transport", 1, "всяка седмица до вкъщи");
  if (a.visit_home === "monthly" && a.current_location) bump("transport", 0.5, "всеки месец до вкъщи");
  if (a.cold_tolerance && a.cold_tolerance !== "fine") bump("nature", 0.5, "предпочитание за климат");
  if (a.heating_costs) bump("nature", 0.5, "сметки за отопление");
  if (a.going_out === "often") bump("amenities", 1, "често навън");
  if (a.going_out === "sometimes") bump("amenities", 0.3, "понякога навън");
  if (a.pets) bump("amenities", 0.2, "домашен любимец → ветеринар");
  if (a.depopulation === "important") bump("demographics", 1.5, "да не се обезлюдява");
  if (a.depopulation === "not_important") {
    w.demographics *= 0.5;
    trace.push("demographics ×0.5: обезлюдяването не е важно");
  }

  for (const d of a.priorities ?? []) bump(d, 2, "приоритет");
  for (const d of a.compromises ?? []) {
    w[d] = Math.round(w[d] * 0.3 * 100) / 100;
    trace.push(`${d} ×0.3: готов на компромис`);
  }

  if (a.budget_eur_month != null && a.housing !== "buy") w[HOUSING] = 1.5;
  if (a.buy_budget_eur != null && a.housing === "buy") w[HOUSING] = 1.5;

  const total = Object.values(w).reduce((s, x) => s + x, 0);
  const normalised = Object.fromEntries(Object.entries(w).map(([k, x]) => [k, Math.round((x / total) * 1000) / 1000]));
  return { raw: w, weights: normalised, trace };
}
