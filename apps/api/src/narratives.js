// "Try your new life" simulation and relocation plan, built from facts only (no LLM yet), in Bulgarian or English.
// A `fact` statement quotes a fact value and cites its id; anything imagined is a `scenario`.

const num = (lang) => (n, d = 1) =>
  n == null ? "?" : Number(n).toLocaleString(lang === "en" ? "en-GB" : "bg-BG", { maximumFractionDigits: d });

function accessor(s) {
  const by = new Map(s.facts.map((f) => [f.metric, f]));
  return (m) => by.get(m) ?? null;
}
const fact = (text, f) => (f && f.value != null ? [{ kind: "fact", text, fact_ids: [f.id] }] : []);
const scenario = (text) => ({ kind: "scenario", text, fact_ids: [] });

export function buildSimulation(s, answers = {}, lang = "bg") {
  const f = accessor(s);
  const a = answers;
  const en = lang === "en";
  const fmt = num(lang);
  const L = (bg, eng) => (en ? eng : bg);
  const name = en ? s.name_en : s.name_bg;
  const centre = s.oblast_centre;
  const scenes = [];

  scenes.push({
    id: "morning",
    time: "07:30",
    title: L("Сутрин", "Morning"),
    statements: [
      scenario(L(`Събуждаш се в ${name}.`, `You wake up in ${name}.`)),
      ...fact(
        L(
          `Мястото е на ${fmt(f("elevation_m")?.value)} м надморска височина, а средната януарска температура е ${fmt(f("jan_mean_temp_c")?.value)} °C.`,
          `The place sits at ${fmt(f("elevation_m")?.value)} m above sea level; the average January temperature is ${fmt(f("jan_mean_temp_c")?.value)} °C.`,
        ),
        f("elevation_m"),
      ),
      ...fact(
        L(`Около ${fmt(f("forest_share_pct")?.value)}% от землището е гора.`, `About ${fmt(f("forest_share_pct")?.value)}% of the land around it is forest.`),
        f("forest_share_pct"),
      ),
    ],
  });

  if (a.household === "family_kids" || a.kids_ages?.length) {
    const ages = a.kids_ages ?? [];
    scenes.push({
      id: "school",
      time: "08:00",
      title: L("Децата", "The kids"),
      statements: [
        ...(!ages.length || ages.some((x) => x < 7)
          ? fact(
              L(`Най-близката детска градина е на ${fmt(f("kindergarten_nearest_km")?.value)} км.`, `The nearest kindergarten is ${fmt(f("kindergarten_nearest_km")?.value)} km away.`),
              f("kindergarten_nearest_km"),
            )
          : []),
        ...(!ages.length || ages.some((x) => x >= 7)
          ? fact(
              L(`Най-близкото училище е на ${fmt(f("school_nearest_km")?.value)} км.`, `The nearest school is ${fmt(f("school_nearest_km")?.value)} km away.`),
              f("school_nearest_km"),
            )
          : []),
        scenario(
          a.has_car === false
            ? L("Пътят до там е пеша или с автобус.", "You get there on foot or by bus.")
            : L("Закарваш ги с колата на път за деня.", "You drop them off by car on the way."),
        ),
      ],
    });
  }

  const work = [];
  if (a.work_mode === "remote" || a.work_mode === "self_employed") {
    const fixed = f("internet_fixed_down_mbps");
    work.push(
      ...fact(
        L(`Измерената скорост на стационарния интернет тук е около ${fmt(fixed?.value, 0)} Mbps.`, `Measured fixed-line internet here is about ${fmt(fixed?.value, 0)} Mbps.`),
        fixed,
      ),
    );
    work.push(scenario(L("Отваряш лаптопа и започваш работния ден от вкъщи.", "You open the laptop and start the working day from home.")));
  } else if (a.work_mode === "office" || a.work_mode === "hybrid") {
    work.push(
      ...fact(
        L(`До ${centre} се стига за ${fmt(f("drive_min_to_oblast_centre")?.value)} мин с кола.`, `${centre} is ${fmt(f("drive_min_to_oblast_centre")?.value)} min away by car.`),
        f("drive_min_to_oblast_centre"),
      ),
    );
    work.push(
      ...fact(
        L(`Най-близката автобусна спирка е на ${fmt(f("bus_stop_nearest_km")?.value)} км.`, `The nearest bus stop is ${fmt(f("bus_stop_nearest_km")?.value)} km away.`),
        f("bus_stop_nearest_km"),
      ),
    );
  } else if (a.work_mode === "looking") {
    work.push(
      ...fact(
        L(
          `Безработицата в община ${s.municipality} е ${fmt(f("unemployment_rate_pct")?.value, 2)}%.`,
          `Unemployment in ${s.municipality} municipality is ${fmt(f("unemployment_rate_pct")?.value, 2)}%.`,
        ),
        f("unemployment_rate_pct"),
      ),
    );
    work.push(
      ...fact(
        L(
          `В областта има ${fmt(f("vacancies_per_100_unemployed")?.value)} обявени работни места на 100 безработни.`,
          `The region has ${fmt(f("vacancies_per_100_unemployed")?.value)} advertised jobs per 100 unemployed.`,
        ),
        f("vacancies_per_100_unemployed"),
      ),
    );
  }
  if (work.length) scenes.push({ id: "work", time: "09:00", title: L("Работа", "Work"), statements: work });

  scenes.push({
    id: "errands",
    time: "12:30",
    title: L("Покупки и услуги", "Errands"),
    statements: [
      ...fact(L(`Най-близкият хранителен магазин е на ${fmt(f("shop_nearest_km")?.value)} км.`, `The nearest grocery shop is ${fmt(f("shop_nearest_km")?.value)} km away.`), f("shop_nearest_km")),
      ...fact(L(`Аптека: на ${fmt(f("pharmacy_nearest_km")?.value)} км.`, `Pharmacy: ${fmt(f("pharmacy_nearest_km")?.value)} km.`), f("pharmacy_nearest_km")),
      ...fact(L(`Поща: на ${fmt(f("post_office_nearest_km")?.value)} км.`, `Post office: ${fmt(f("post_office_nearest_km")?.value)} km.`), f("post_office_nearest_km")),
    ],
  });

  if ((a.healthcare_needs && a.healthcare_needs !== "none") || a.household === "retired") {
    scenes.push({
      id: "health",
      time: "15:00",
      title: L("Преглед", "Check-up"),
      statements: [
        ...fact(L(`Най-близкият лекар е на ${fmt(f("doctor_nearest_km")?.value)} км.`, `The nearest doctor is ${fmt(f("doctor_nearest_km")?.value)} km away.`), f("doctor_nearest_km")),
        ...fact(L(`Най-близката болница е на ${fmt(f("hospital_nearest_km")?.value)} км.`, `The nearest hospital is ${fmt(f("hospital_nearest_km")?.value)} km away.`), f("hospital_nearest_km")),
      ],
    });
  }

  scenes.push({
    id: "evening",
    time: "18:30",
    title: L("Вечер", "Evening"),
    statements: [
      ...fact(L(`Най-близката река или езеро е на ${fmt(f("water_nearest_km")?.value)} км.`, `The nearest river or lake is ${fmt(f("water_nearest_km")?.value)} km away.`), f("water_nearest_km")),
      ...fact(
        L(
          `Заведения в мястото: ${fmt(f("food_drink_count")?.value, 0)}; културни места (читалище, библиотека, кино…): ${fmt(f("culture_count")?.value, 0)}.`,
          `Cafés and restaurants here: ${fmt(f("food_drink_count")?.value, 0)}; cultural venues (community centre, library, cinema…): ${fmt(f("culture_count")?.value, 0)}.`,
        ),
        f("food_drink_count"),
      ),
      scenario(L("Разхождаш се и поздравяваш съседите.", "You take a walk and say hello to the neighbours.")),
    ],
  });

  const facts = s.facts.filter((x) => scenes.some((sc) => sc.statements.some((st) => st.fact_ids.includes(x.id))));
  return { ekatte: s.ekatte, scenes, facts };
}

export function buildPlan(s, answers = {}, lang = "bg") {
  const f = accessor(s);
  const a = answers;
  const en = lang === "en";
  const fmt = num(lang);
  const L = (bg, eng) => (en ? eng : bg);
  const name = en ? s.name_en : s.name_bg;
  const item = (id, text, ...fs) => ({ id, text, fact_ids: fs.filter((x) => x?.value != null).map((x) => x.id) });
  const sections = [];

  const rent = f("rent_2room_eur_month");
  const est = rent?.status === "estimated" ? L(" (ориентир)", " (estimate)") : "";
  sections.push({
    key: "housing",
    items: [
      item(
        "housing-budget",
        L(
          `Типичният наем на двустаен е ${fmt(rent?.value)} EUR/месец${est}.${a.budget_eur_month ? ` Бюджетът ти е ${fmt(a.budget_eur_month)} EUR.` : ""}`,
          `A typical 2-room flat rents for ${fmt(rent?.value)} EUR/month${est}.${a.budget_eur_month ? ` Your budget is ${fmt(a.budget_eur_month)} EUR.` : ""}`,
        ),
        rent,
      ),
      item("housing-visit", L(`Огледай жилища на място в ${name}, преди да подпишеш договор.`, `See homes in ${name} in person before you sign anything.`)),
    ],
  });

  if (a.work_mode && !["remote", "not_working"].includes(a.work_mode)) {
    sections.push({
      key: "employment",
      items: [
        item(
          "jobs-market",
          L(`Безработицата в община ${s.municipality} е ${fmt(f("unemployment_rate_pct")?.value, 2)}%.`, `Unemployment in ${s.municipality} municipality is ${fmt(f("unemployment_rate_pct")?.value, 2)}%.`),
          f("unemployment_rate_pct"),
        ),
        item("jobs-register", L(`Регистрирай се в бюрото по труда в ${s.oblast_centre} за обявите в областта.`, `Register with the labour office in ${s.oblast_centre} to see the region's job ads.`)),
      ],
    });
  }

  sections.push({
    key: "healthcare",
    items: [
      item("gp", L(`Избери личен лекар. Най-близкият е на ${fmt(f("doctor_nearest_km")?.value)} км.`, `Register with a GP. The nearest is ${fmt(f("doctor_nearest_km")?.value)} km away.`), f("doctor_nearest_km")),
      item("hospital", L(`Най-близката болница е на ${fmt(f("hospital_nearest_km")?.value)} км.`, `The nearest hospital is ${fmt(f("hospital_nearest_km")?.value)} km away.`), f("hospital_nearest_km")),
    ],
  });

  if (a.household === "family_kids" || a.kids_ages?.length) {
    sections.push({
      key: "education",
      items: [
        item("school", L(`Подай документи за училище. Най-близкото е на ${fmt(f("school_nearest_km")?.value)} км.`, `Apply for a school place. The nearest school is ${fmt(f("school_nearest_km")?.value)} km away.`), f("school_nearest_km")),
        item(
          "kindergarten",
          L(`Провери за места в детска градина. Най-близката е на ${fmt(f("kindergarten_nearest_km")?.value)} км.`, `Check for kindergarten places. The nearest is ${fmt(f("kindergarten_nearest_km")?.value)} km away.`),
          f("kindergarten_nearest_km"),
        ),
      ],
    });
  }

  sections.push({
    key: "transport",
    items: [
      item("drive", L(`До ${s.oblast_centre} се пътува ${fmt(f("drive_min_to_oblast_centre")?.value)} мин с кола.`, `${s.oblast_centre} is ${fmt(f("drive_min_to_oblast_centre")?.value)} min away by car.`), f("drive_min_to_oblast_centre")),
      item("bus", L(`Провери разписанието на автобусите. Най-близката спирка е на ${fmt(f("bus_stop_nearest_km")?.value)} км.`, `Check the bus timetable. The nearest stop is ${fmt(f("bus_stop_nearest_km")?.value)} km away.`), f("bus_stop_nearest_km")),
    ],
  });

  sections.push({
    key: "admin",
    items: [
      item("address", L(`Смени постоянния и настоящия си адрес в община ${s.municipality}.`, `Register your new permanent and current address with ${s.municipality} municipality.`)),
      item("tax", L("Декларирай имота и колата в новата община (местни данъци).", "Declare your property and car with the new municipality (local taxes).")),
    ],
  });

  sections.push({
    key: "community",
    items: [
      item(
        "people",
        L(
          `В ${name} живеят ${fmt(f("population_2021")?.value, 0)} души (преброяване 2021). Читалището е добро място за първи познанства.`,
          `${fmt(f("population_2021")?.value, 0)} people live in ${name} (2021 census). The local chitalishte (community centre) is a good place to meet people.`,
        ),
        f("population_2021"),
      ),
    ],
  });

  return { ekatte: s.ekatte, sections };
}
