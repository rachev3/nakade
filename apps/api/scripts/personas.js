// Hand-made profiles (ProfileAnswers, see apps/web/src/api/openapi.yaml) for the demo and golden tests.
export const PERSONAS = {
  remote_family: {
    label: "Семейство от София, работят дистанционно, с кола, деца на 4 и 9, искат планина и тишина",
    answers: {
      current_location: "68134",
      household: "family_kids",
      work_mode: "remote",
      has_car: true,
      priorities: ["nature", "education"],
      must_haves: ["school", "fast_internet"],
      kids_ages: [4, 9],
      nature: ["mountains", "forest"],
      community: "quiet",
    },
  },
  retired_no_car: {
    label: "Пенсионери от Плевен, без кола, редовни прегледи, наем до 350 EUR",
    answers: {
      current_location: "56722",
      household: "retired",
      work_mode: "not_working",
      has_car: false,
      priorities: ["healthcare", "amenities", "transport"],
      must_haves: ["hospital_30min", "pharmacy"],
      healthcare_needs: "regular",
      housing: "rent",
      budget_eur_month: 350,
      community: "either",
    },
  },
  young_jobseeker: {
    label: "Млад човек от Видин, търси работа, без кола, наем до 400 EUR, иска оживено място",
    answers: {
      current_location: "10971",
      household: "single",
      work_mode: "looking",
      has_car: false,
      priorities: ["employment", "transport", "amenities"],
      housing: "rent",
      budget_eur_month: 400,
      community: "lively",
    },
  },
  hybrid_commuter: {
    label: "Двойка от София, хибридна работа, с кола, до 40 мин до работа, влак до София",
    answers: {
      current_location: "68134",
      household: "couple",
      work_mode: "hybrid",
      has_car: true,
      priorities: ["nature", "transport"],
      must_haves: ["train_to_sofia"],
      max_commute_min: 40,
      community: "quiet",
    },
  },
};
