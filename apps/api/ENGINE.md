# Matching engine

Deterministic, explainable ranking of the 90 pilot settlements for a user's answers. No LLM, no randomness. Implements [docs/proposals/backend.md §4](../../docs/proposals/backend.md#4-matching-algorithm-suggested-approach) and speaks the frontend's draft contract ([apps/web/src/api/openapi.yaml](../web/src/api/openapi.yaml)): input is `ProfileAnswers`, output is `Match[]`.

```
ProfileAnswers ──► weights (7 dimensions, + housing) ─┐
                                                      ├─► dimension scores ─► weighted score ─► must-haves ─► Match[]
settlements (Mongo, facts with provenance) ───────────┘                       + reasons / tradeoffs / unknowns
```

| File | What it does |
|---|---|
| `src/engine/answers.js` | Validates `ProfileAnswers`; answers → weights (with a `trace` of every rule) |
| `src/engine/score.js` | One scorer per dimension, must-have checks |
| `src/engine/index.js` | `createEngine(settlements)` → `rank(answers, { ekatte?, type?, limit? })`, texts |
| `src/engine/origins.js` | The 27 oblast centres accepted as `current_location` |
| `src/db.js` | Loads `settlements` from MongoDB |

```powershell
npm install
npm test                          # golden tests, offline on data/processed/settlements_enriched.json
npm run match                     # sample personas against MongoDB Atlas (reads data/pipeline/.env)
npm run match -- hybrid_commuter  # one persona
npm run match -- --answers my-answers.json
```

## Data

The database holds only the 90 pilot settlements (`settlements`, `_id` = EKATTE). [data/pipeline/enrich-settlements.mjs](../../data/pipeline/enrich-settlements.mjs) builds them from the pilot dataset (OSM, OSRM, Ookla, Open-Meteo) plus census 2011/2021, municipal unemployment 2025 and housing listings, and stores every value as a contract `Fact` (`status`, `method`, `source`, `retrieved_at`).

## Weights

Every dimension starts at 1, the rules below adjust it, then everything is normalised to sum 1.

| Answer | Effect |
|---|---|
| `household: family_kids` or `kids_ages` | education +1.5; otherwise education = 0.2 |
| `household: retired` | healthcare +1, employment = 0 |
| `work_mode: remote` | employment = 0.3, amenities +0.5 (internet) |
| `work_mode: office / hybrid` | employment +1, transport +1 |
| `work_mode: self_employed` | employment = 0.7, amenities +0.3 |
| `work_mode: looking` | employment +1.5 |
| `work_mode: not_working` | employment = 0.2 |
| `has_car: false` | transport +1.5, amenities +0.5, stricter distance curves everywhere |
| `healthcare_needs: regular / specialist` | healthcare +1 / +2 (specialist: hospital counts more) |
| `nature` not empty | nature +1 |
| `priorities` | +2 each |
| `compromises` | ×0.3 each |
| `budget_eur_month` (not buying) | adds `housing` = 1.5 |

## Dimensions and metrics

| Dimension | Metrics (fact `metric` keys) |
|---|---|
| transport | `drive_min_to_oblast_centre` (OSRM), `bus_stop_nearest_km`, `train_station_nearest_km`; office/hybrid with `max_commute_min`: drive time to `current_location` (the job is assumed to stay there), otherwise to the oblast centre |
| healthcare | `hospital_nearest_km`, `doctor_nearest_km`, `pharmacy_nearest_km` |
| education | `kindergarten_nearest_km` (kids under 7), `school_nearest_km` (7+); both when ages are unknown |
| amenities | `shop/post_office/food_drink/culture_nearest_km`, best of `internet_fixed/mobile_down_mbps` |
| nature | no preference: forest share, forest/water/protected area distance. `mountains`/`plains` → `elevation_m`, `forest`, `water`. `sea` → unknown (no coast data yet) |
| employment | `unemployment_rate_pct` (municipality), `vacancies_per_100_unemployed` (oblast) |
| demographics | `population_trend_pct` 2011→2021; `community: quiet / lively` → smaller / bigger `population_2021` |
| housing | `budget_eur_month` / `rent_2room_eur_month` (median of listings; **villages and 5 cities use the nearby city's median and are `estimated`**) |

Distances in km are straight-line (OSM); drive times are OSRM routes.

## Must-haves

Places that fail are kept, marked `passes_constraints: false` with `excluded_because`, and ranked after all passing places (same as the mock). A must-have without data passes and is listed in `unknowns`.

| must_have | Rule |
|---|---|
| `hospital_30min` | hospital ≤ 20 km straight-line (an estimate for ~30 min by car, said in the text) |
| `school` / `kindergarten` / `pharmacy` | one in the settlement, or the nearest within 5 / 3 / 3 km |
| `train_to_sofia` | a station within 5 km. Which lines stop there is unknown → always `unknowns: train_lines_to_sofia` |
| `fast_internet` | fixed or mobile median ≥ 50 Mbps (Ookla) |

## Output

`Match` exactly as in the contract, with three additions the frontend can ignore or use:

- `reasons` / `tradeoffs` / `excluded_because` items have the contract's `text_key` (`reason.<dim>`, `tradeoff.<dim>`, `constraint.<must_have>`, matching the existing i18n keys) and `params`, **plus `text`**, a full Bulgarian sentence built from the facts.
- `facts`: request-specific facts (drive time to the user's `current_location`), referenced by `evidence`.
- `confidence`: weighted share of data behind the score (verified 1, derived 0.85, estimated 0.5, missing 0).

## Contract notes for the frontend

1. **`housing` dimension**: not in the `Dimension` enum yet. Proposed addition; it appears only when the user gives a rent budget.
2. **`current_location`**: an oblast centre EKATTE (`origins.js`) or any pilot EKATTE.
3. **Fixture EKATTE codes are off**: e.g. Трявна is `73403`, not `73198`. Use the codes from `settlements`.
4. **`hospital_30min`** is answered from straight-line distance until we have drive times to hospitals.
