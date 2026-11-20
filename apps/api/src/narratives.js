// "Try your new life" simulation and relocation plan, built from facts only (no LLM yet).
// A `fact` statement quotes a fact value and cites its id; anything imagined is a `scenario`.

const fmt = (n, d = 1) => (n == null ? "?" : Number(n).toLocaleString("bg-BG", { maximumFractionDigits: d }));

function accessor(s) {
  const by = new Map(s.facts.map((f) => [f.metric, f]));
  return (m) => by.get(m) ?? null;
}
const fact = (text, f) => (f && f.value != null ? [{ kind: "fact", text, fact_ids: [f.id] }] : []);
const scenario = (text) => ({ kind: "scenario", text, fact_ids: [] });
const est = (f) => (f?.status === "estimated" ? " (ориентир)" : "");

export function buildSimulation(s, answers = {}) {
  const f = accessor(s);
  const a = answers;
  const name = s.name_bg;
  const scenes = [];

  scenes.push({
    id: "morning",
    time: "07:30",
    title: "Сутрин",
    statements: [
      scenario(`Събуждаш се в ${name}.`),
      ...fact(`Мястото е на ${fmt(f("elevation_m")?.value)} м надморска височина, а средната януарска температура е ${fmt(f("jan_mean_temp_c")?.value)} °C.`, f("elevation_m")),
      ...fact(`Около ${fmt(f("forest_share_pct")?.value)}% от землището е гора.`, f("forest_share_pct")),
    ],
  });

  if (a.household === "family_kids" || a.kids_ages?.length) {
    const ages = a.kids_ages ?? [];
    scenes.push({
      id: "school",
      time: "08:00",
      title: "Децата",
      statements: [
        ...(!ages.length || ages.some((x) => x < 7) ? fact(`Най-близката детска градина е на ${fmt(f("kindergarten_nearest_km")?.value)} км.`, f("kindergarten_nearest_km")) : []),
        ...(!ages.length || ages.some((x) => x >= 7) ? fact(`Най-близкото училище е на ${fmt(f("school_nearest_km")?.value)} км.`, f("school_nearest_km")) : []),
        scenario(a.has_car === false ? "Пътят до там е пеша или с автобус." : "Закарваш ги с колата на път за деня."),
      ],
    });
  }

  const work = [];
  if (a.work_mode === "remote" || a.work_mode === "self_employed") {
    const fixed = f("internet_fixed_down_mbps");
    work.push(...fact(`Измерената скорост на стационарния интернет тук е около ${fmt(fixed?.value, 0)} Mbps.`, fixed));
    work.push(scenario("Отваряш лаптопа и започваш работния ден от вкъщи."));
  } else if (a.work_mode === "office" || a.work_mode === "hybrid") {
    work.push(...fact(`До ${s.oblast_centre} се стига за ${fmt(f("drive_min_to_oblast_centre")?.value)} мин с кола.`, f("drive_min_to_oblast_centre")));
    work.push(...fact(`Най-близката автобусна спирка е на ${fmt(f("bus_stop_nearest_km")?.value)} км.`, f("bus_stop_nearest_km")));
  } else if (a.work_mode === "looking") {
    work.push(...fact(`Безработицата в община ${s.municipality} е ${fmt(f("unemployment_rate_pct")?.value, 2)}%.`, f("unemployment_rate_pct")));
    work.push(...fact(`В областта има ${fmt(f("vacancies_per_100_unemployed")?.value)} обявени работни места на 100 безработни.`, f("vacancies_per_100_unemployed")));
  }
  if (work.length) scenes.push({ id: "work", time: "09:00", title: "Работа", statements: work });

  scenes.push({
    id: "errands",
    time: "12:30",
    title: "Покупки и услуги",
    statements: [
      ...fact(`Най-близкият хранителен магазин е на ${fmt(f("shop_nearest_km")?.value)} км.`, f("shop_nearest_km")),
      ...fact(`Аптека: на ${fmt(f("pharmacy_nearest_km")?.value)} км.`, f("pharmacy_nearest_km")),
      ...fact(`Поща: на ${fmt(f("post_office_nearest_km")?.value)} км.`, f("post_office_nearest_km")),
    ],
  });

  if ((a.healthcare_needs && a.healthcare_needs !== "none") || a.household === "retired") {
    scenes.push({
      id: "health",
      time: "15:00",
      title: "Преглед",
      statements: [
        ...fact(`Най-близкият лекар е на ${fmt(f("doctor_nearest_km")?.value)} км.`, f("doctor_nearest_km")),
        ...fact(`Най-близката болница е на ${fmt(f("hospital_nearest_km")?.value)} км.`, f("hospital_nearest_km")),
      ],
    });
  }

  scenes.push({
    id: "evening",
    time: "18:30",
    title: "Вечер",
    statements: [
      ...fact(`Най-близката река или езеро е на ${fmt(f("water_nearest_km")?.value)} км.`, f("water_nearest_km")),
      ...fact(`Заведения в мястото: ${fmt(f("food_drink_count")?.value, 0)}; културни места (читалище, библиотека, кино…): ${fmt(f("culture_count")?.value, 0)}.`, f("food_drink_count")),
      scenario("Разхождаш се и поздравяваш съседите."),
    ],
  });

  const facts = s.facts.filter((x) => scenes.some((sc) => sc.statements.some((st) => st.fact_ids.includes(x.id))));
  return { ekatte: s.ekatte, scenes, facts };
}

export function buildPlan(s, answers = {}) {
  const f = accessor(s);
  const a = answers;
  const item = (id, text, ...fs) => ({ id, text, fact_ids: fs.filter((x) => x?.value != null).map((x) => x.id) });
  const sections = [];

  const rent = f("rent_2room_eur_month");
  sections.push({
    key: "housing",
    items: [
      item("housing-budget", `Типичният наем на двустаен е ${fmt(rent?.value)} EUR/месец${est(rent)}.${a.budget_eur_month ? ` Бюджетът ти е ${fmt(a.budget_eur_month)} EUR.` : ""}`, rent),
      item("housing-visit", `Огледай жилища на място в ${s.name_bg}, преди да подпишеш договор.`),
    ],
  });

  if (a.work_mode && !["remote", "not_working"].includes(a.work_mode)) {
    sections.push({
      key: "employment",
      items: [
        item("jobs-market", `Безработицата в община ${s.municipality} е ${fmt(f("unemployment_rate_pct")?.value, 2)}%.`, f("unemployment_rate_pct")),
        item("jobs-register", `Регистрирай се в бюрото по труда в ${s.oblast_centre} за обявите в областта.`),
      ],
    });
  }

  sections.push({
    key: "healthcare",
    items: [
      item("gp", `Избери личен лекар. Най-близкият е на ${fmt(f("doctor_nearest_km")?.value)} км.`, f("doctor_nearest_km")),
      item("hospital", `Най-близката болница е на ${fmt(f("hospital_nearest_km")?.value)} км.`, f("hospital_nearest_km")),
    ],
  });

  if (a.household === "family_kids" || a.kids_ages?.length) {
    sections.push({
      key: "education",
      items: [
        item("school", `Подай документи за училище. Най-близкото е на ${fmt(f("school_nearest_km")?.value)} км.`, f("school_nearest_km")),
        item("kindergarten", `Провери за места в детска градина. Най-близката е на ${fmt(f("kindergarten_nearest_km")?.value)} км.`, f("kindergarten_nearest_km")),
      ],
    });
  }

  sections.push({
    key: "transport",
    items: [
      item("drive", `До ${s.oblast_centre} се пътува ${fmt(f("drive_min_to_oblast_centre")?.value)} мин с кола.`, f("drive_min_to_oblast_centre")),
      item("bus", `Провери разписанието на автобусите. Най-близката спирка е на ${fmt(f("bus_stop_nearest_km")?.value)} км.`, f("bus_stop_nearest_km")),
    ],
  });

  sections.push({
    key: "admin",
    items: [
      item("address", `Смени постоянния и настоящия си адрес в община ${s.municipality}.`),
      item("tax", "Декларирай имота и колата в новата община (местни данъци)."),
    ],
  });

  sections.push({
    key: "community",
    items: [item("people", `В ${s.name_bg} живеят ${fmt(f("population_2021")?.value, 0)} души (преброяване 2021). Читалището е добро място за първи познанства.`, f("population_2021"))],
  });

  return { ekatte: s.ekatte, sections };
}
