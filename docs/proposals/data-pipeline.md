# Proposal — Data pipeline & sources

Owner: Data team · Status: **Proposal, for discussion**

## 1. Principles

- **Offline only.** The pipeline runs on demand or on a schedule, never during a user request.
- **Raw is immutable.** Every source response, file or page is saved exactly as received, with a timestamp. Everything after that can be re-run from raw.
- **One adapter per source.** API, CSV and scraped sources differ only in their first step. All of them output the same normalized record.
- **Provenance on every value.** No value enters the DB without a source and a status.
- **Never invent.** If a value is unknown, it is stored as missing, not guessed. Estimates are allowed only when marked `estimated`, with the method recorded.

## 2. Stages

```
1. INGEST      fetch → data/raw/<source>/<YYYY-MM-DD>/...     (API JSON, CSV, HTML)
2. NORMALIZE   adapter → records (settlement_ref, metric, value, unit, source, retrieved_at)
3. RESOLVE     settlement_ref → EKATTE code (name + municipality + coordinates)
4. ENRICH      derived metrics: travel times, nearest service, catchment for villages
5. VALIDATE    schema checks, ranges, coverage report per dimension
6. LOAD        write settlement / fact / source tables (dev DB first, then prod)
```

Each run writes a **run report**: rows per source, unresolved settlements, missing metrics per dimension, warnings.

## 3. Handling each source type

| Type | Ingest | Watch out for |
|---|---|---|
| **API** | Scripted fetch with retries and backoff; cache responses in raw | Rate limits, API keys (in env vars, never in git), pagination |
| **CSV / XLSX** | Download into raw; detect encoding | Windows-1251 Cyrillic, changing column names, merged header rows. Validate columns on every load |
| **Scraping** | Polite crawler (low rate, identifying User-Agent, caching); save HTML to raw, parse separately | Check robots.txt and terms first. Prefer an official dataset whenever one exists. Parsers break when the page changes, so keep them small and tested |
| **Manual** | Hand-collected values in a reviewed CSV in the repo | Must still have a source URL + date; status `verified` only if checked against the source |

## 4. The fact record

The shared contract between pipeline, API and UI:

```jsonc
{
  "id": "fact_123",
  "ekatte": "73198",
  "dimension": "healthcare",            // one of the 7 dimensions
  "metric": "drive_min_to_hospital",
  "value": 18, "unit": "min",
  "status": "derived",                  // verified | derived | estimated
  "method": "OSRM car routing to nearest hospital (OSM)",
  "source_id": "osm",
  "retrieved_at": "2026-11-20"
}
```

## 5. Settlement identity: EKATTE

Use the **EKATTE** code (NSI's Unified Classifier of Administrative-Territorial Units) as the primary key. Name matching alone fails: many villages share names, and sources spell them differently. Resolve by name + municipality, and use coordinates as a tiebreaker. Keep a manual override table for edge cases.

## 6. Candidate sources (to verify: coverage, licence, freshness)

| Dimension | Candidates |
|---|---|
| Demographics, settlement development | NSI (population, age structure, migration), EKATTE register |
| Healthcare | Ministry of Health / RHI registries of medical facilities; OSM `amenity=hospital/clinic/doctors/pharmacy` |
| Education | Ministry of Education school & kindergarten registry; OSM `amenity=school/kindergarten` |
| Everyday amenities | OSM (shops, post, banks, cafés, sports) |
| Transport | BDZ rail schedules, intercity bus schedules, OSM road network + OSRM/OpenRouteService for travel times |
| Nature & environment | OSM land use, protected areas (Natura 2000 / EEA), air quality (EEA / national monitoring) |
| Employment & economy | NSI / Employment Agency regional data, job-board counts (scraping, if terms allow) |
| General | data.egov.bg (Bulgarian open data portal) |

Track each source in [`data/sources.md`](../../data/sources.md).

## 7. Suggested tooling (Python)

- `uv` for environment and dependencies
- `httpx` (API/scrape), `selectolax` or `BeautifulSoup` (HTML), `pandas`/`polars` (tables), `geopandas`/`shapely` (geo), `pandera` or Pydantic (validation)
- OSM extracts via Geofabrik (Bulgaria) + `osmium`/`pyrosm`, rather than querying the Overpass API heavily
- Routing: self-hosted OSRM with the Bulgaria extract (free, unlimited) or the OpenRouteService API
- Runs locally first. Later on a GitHub Actions schedule

## 8. Open questions for the data team

- Final list of ~30 towns and their villages: by what criteria?
- Minimum metrics per dimension to call it "covered"?
- How often do we refresh each source? (Likely once is enough for the hackathon.)
- Where does raw data live: in the repo (small), or in R2 (large)?
