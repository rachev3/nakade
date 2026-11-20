# Data sources

One row per source. Fill this in before writing an adapter. See [docs/proposals/data-pipeline.md](../docs/proposals/data-pipeline.md).

| id | Name | URL | Type (api/csv/scrape/manual) | Dimensions | Licence / terms | Refresh | Status | Owner |
|---|---|---|---|---|---|---|---|---|
| osm | OpenStreetMap (Geofabrik Bulgaria extract) | https://download.geofabrik.de/europe/bulgaria.html | file (.osm.pbf) | identity, admin units, population (tag), amenities, healthcare, education, transport, nature | ODbL 1.0 — attribution "© OpenStreetMap contributors" | daily extract; pulled 2026-11-20 | in use | Data team |
| open-meteo | Open-Meteo Elevation + Historical Weather API | https://open-meteo.com/en/docs | api | elevation, climate (HDD/CDD, January temp) | CC BY 4.0; free tier is non-commercial, 10k calls/day | once per year | in use | Data team |
| ookla | Ookla Open Data (Speedtest performance tiles) | https://github.com/teamookla/ookla-open-data | file (parquet on S3) | internet speed (fixed, mobile) | CC BY-NC-SA 4.0 — non-commercial only | quarterly; using 2026 Q3 | in use | Data team |
| osrm | OSRM public demo server | https://project-osrm.org/ | api | car travel times | demo server: light use only, no SLA; data © OSM contributors | per run | in use (replace with self-hosted OSRM for production) | Data team |
| nsi-population | NSI / GRAO population by settlement | https://www.nsi.bg/ · https://www.grao.bg/ | manual (`data/manual/population.csv`) | demographics | public | yearly | optional, template only | Data team |
