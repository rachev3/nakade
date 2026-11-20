# data/pipeline — Data ingestion & normalization

See [docs/proposals/data-pipeline.md](../../docs/proposals/data-pipeline.md). Owner: Data team.

## Pilot dataset: 30 cities + 60 nearby settlements

`build_dataset.py` builds one table for the 30 most populated Bulgarian cities (by OSM `population` tag)
plus 2 nearby settlements for each (90 rows).

```bash
python3 -m venv data/pipeline/.venv
data/pipeline/.venv/bin/pip install osmium shapely duckdb
mkdir -p data/raw/osm/2026-11-20
curl -L -o data/raw/osm/2026-11-20/bulgaria-latest.osm.pbf https://download.geofabrik.de/europe/bulgaria-latest.osm.pbf
data/pipeline/.venv/bin/python data/pipeline/build_dataset.py
```

Network responses are cached in `data/raw/<source>/<date>/` and stage results in `data/interim/`
(both gitignored). Delete a file there to recompute that step. Outputs go to `data/processed/`:

| File | Contents |
|---|---|
| `settlements.csv` | one row per settlement, all metrics (wide) |
| `settlements.json` | same, plus a nested `drive_to_oblast_centres` map |
| `drive_to_oblast_centres.csv` | long table: every settlement × all 27 oblast centres (min, km) |
| `run_report.md` | coverage: missing values per column, fallbacks used |

### How settlements are chosen

1. **Cities:** places tagged `place=city|town` with an `ekatte` code, ranked by OSM `population`; top 30.
2. **Nearby (2 per city):** within 3–30 km straight line, not already chosen:
   - slot 1: the nearest `place=town` (a small town), if one exists in range;
   - slot 2 (and slot 1 if no town): the nearest `place=village` with population ≥ 300;
   - if still short, the nearest village with no population tag.

OSM population tags are sometimes rounded or out of date, so ranks near the cutoff (28–33) are close calls.
Fill `data/manual/population.csv` with NSI/GRAO figures to get `population_<year>` columns.

### “На място” (on site) — the settlement area

Counts (`*_count`) are features inside the settlement's own **землище** (EKATTE territory, OSM
`boundary=administrative` + `ekatte=*`). Where OSM has no землище for a settlement, a circle is used
(village 1.5 km, town 3 km, city 6 km). `area_basis` says which was used.

### Column dictionary

| Column | Meaning | Source / method |
|---|---|---|
| `ekatte`, `name`, `name_en` | EKATTE code, Bulgarian / English name | OSM place node |
| `type`, `osm_place` | вид (град / село), raw OSM `place` | OSM |
| `role`, `city_rank`, `parent_city`, `km_from_parent` | city or nearby; rank of the city; straight-line km to it | derived |
| `oblast`, `oblast_iso`, `municipality`, `municipality_code` | област, община | point-in-polygon on OSM admin boundaries (level 4 / 5) |
| `population_osm`, `population_osm_date` | население (OSM tag) | OSM `population` |
| `lat`, `lon`, `osm_id` | coordinates of the OSM place node | OSM |
| `area_basis`, `area_km2` | what “on site” means for this row | see above |
| `<cat>_nearest_km` | straight-line km from the place node to the nearest feature (0 = inside a polygon) | OSM |
| `<cat>_count` | number of features on site | OSM |
| `forest_share_pct` | % of the settlement area covered by forest | OSM |
| `elevation_m` | надморска височина (90 m DEM) | Open-Meteo Elevation API |
| `hdd_per_year`, `cdd_per_year` | heating / cooling degree days, mean of Jul 2024–Jun 2026 | Open-Meteo archive, daily mean temp; Eurostat method: HDD = 18 − T when T ≤ 15 °C, CDD = T − 21 when T ≥ 24 °C |
| `jan_mean_temp_c` | mean January temperature (Jan 2025 + Jan 2026) | Open-Meteo archive |
| `heating_vs_sofia_pct` | HDD as % of Sofia's (100 = same heating need, 120 = 20 % more) | derived |
| `internet_{fixed,mobile}_{down,up}_mbps`, `_latency_ms`, `_tests` | test-weighted average of Speedtest tiles in the settlement area, 2026 Q3 | Ookla Open Data |
| `internet_{fixed,mobile}_basis` | `settlement_area`, or `within_3km` when no tile fell inside | derived |
| `oblast_centre`, `drive_min_to_oblast_centre`, `drive_km_to_oblast_centre` | car time/distance to own oblast centre (0 for the centre itself) | OSRM table service |
| `population_<year>` | NSI/GRAO population (only if `data/manual/population.csv` has rows) | manual |

Categories (`<cat>`): `school` училище · `kindergarten` детска градина · `doctor` лекар (`amenity=doctors|clinic`,
`healthcare=doctor|clinic|centre`) · `hospital` болница · `pharmacy` аптека · `shop` хранителен магазин
(supermarket, convenience, general, grocery, bakery, butcher…) · `bus_stop` спирка (bus, trolleybus, tram, bus
station) · `train_station` гара (railway station/halt, no metro; deduped by name) · `post_office` поща ·
`vet` ветеринар · `culture` култура (theatre, cinema, library, arts centre, читалище/community centre, museum) ·
`food_drink` заведения (restaurant, cafe, bar, pub, fast food) · `forest` гора (`landuse=forest`, `natural=wood`) ·
`water` вода (rivers + lakes/reservoirs; ponds, canals, pools excluded) ·
`protected` защитена зона (`boundary=protected_area|national_park`, `leisure=nature_reserve`).

For forest, water and protected areas, `_count` is the number of **distinct named** features touching the
settlement area, plus unnamed polygons of at least 5 ha (so tiny unnamed ponds and forest fragments don't
inflate it). A river crossing the area counts once.

### Known limits

- Distances to amenities are straight-line, not by road. Only the oblast-centre times use road routing.
- OSM completeness varies: a missing amenity in a village may be unmapped rather than absent.
- Ookla data is crowd-sourced; rows with few `_tests` are noisy. Licence is non-commercial (CC BY-NC-SA).
- OSRM demo server is fine for 90 rows; use a self-hosted OSRM for anything bigger.
