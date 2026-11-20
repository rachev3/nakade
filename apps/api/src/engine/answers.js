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
};

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

  one("household");
  one("work_mode");
  one("housing");
  one("healthcare_needs");
  one("community");
  many("priorities", DIMENSIONS, 3);
  many("compromises", DIMENSIONS);
  many("must_haves", ENUMS.must_haves);
  many("nature", ENUMS.nature);
  if (a.kids_ages != null && (!Array.isArray(a.kids_ages) || a.kids_ages.some((x) => !Number.isInteger(x) || x < 0 || x > 18)))
    errors.push("kids_ages: expected integers 0..18");
  int("budget_eur_month", 0, 100000);
  int("max_commute_min", 0, 240);
  if (a.has_car != null && typeof a.has_car !== "boolean") errors.push("has_car: expected a boolean");
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

  for (const d of a.priorities ?? []) bump(d, 2, "приоритет");
  for (const d of a.compromises ?? []) {
    w[d] = Math.round(w[d] * 0.3 * 100) / 100;
    trace.push(`${d} ×0.3: готов на компромис`);
  }

  if (a.budget_eur_month != null && a.housing !== "buy") w[HOUSING] = 1.5;

  const total = Object.values(w).reduce((s, x) => s + x, 0);
  const normalised = Object.fromEntries(Object.entries(w).map(([k, x]) => [k, Math.round((x / total) * 1000) / 1000]));
  return { raw: w, weights: normalised, trace };
}
