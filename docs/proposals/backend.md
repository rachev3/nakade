# Proposal — Backend API & matching algorithm

Owner: BE team · Status: **Proposal, for discussion**. Everything here is a suggestion. Change anything, then record the decisions in [../architecture.md](../architecture.md#5-decisions-log).

## 1. Responsibilities

- Serve settlements and their facts (read-only, written by the pipeline)
- Own the **matching algorithm**: profile → ranked places with explanations
- Anonymous sessions and user data: profile, swipes, saved places
- Call the LLM for explanations, simulation and plan (see [ai.md](ai.md)). Keys stay server-side
- Publish an **OpenAPI spec**, which the frontend generates its client from

## 2. Stack options

| | **A — Python** | **B — TypeScript on Cloudflare** |
|---|---|---|
| Framework | FastAPI + Pydantic | Hono + Zod |
| DB | Postgres (Neon, PostGIS available) | Cloudflare D1 (SQLite) |
| Hosting | Cloudflare Containers, or Fly.io / Render | Cloudflare Workers |
| OpenAPI | Built into FastAPI | `@hono/zod-openapi` |
| Pros | Same language as the data pipeline; best numeric/geo libraries | One platform, free tier, near-zero ops, very fast |
| Cons | Second runtime to host | Data/algorithm work outside Python |

**Suggestion:** choose by the team's strongest language. If the algorithm and data people are Python-first, go with **A**. Keep the algorithm in **one** language. Don't split scoring across Python and TS.

In both options the web Worker proxies `/api/*` to the backend, so the frontend sees a single origin.

## 3. API sketch

```
POST   /api/session                      → { session_id }          (anonymous, cookie)
GET    /api/profile                      → Profile
PATCH  /api/profile                      ← partial answers (progressive profiling)

GET    /api/settlements                  → [SettlementSummary]
GET    /api/settlements/{ekatte}         → Settlement + facts[] + nearby[]

POST   /api/matches                      → [Match]  (for current profile; optional filters)
POST   /api/swipes                       ← { ekatte, action: like|dislike|save }
GET    /api/saved                        → [SettlementSummary]

POST   /api/settlements/{ekatte}/simulation  → Simulation  (scenes tagged fact|scenario)
POST   /api/settlements/{ekatte}/plan        → RelocationPlan
```

Suggested `Match` shape:

```jsonc
{
  "ekatte": "73198",
  "score": 0.81,                       // 0..1, deterministic
  "passes_constraints": true,
  "dimensions": [
    { "key": "healthcare", "score": 0.72, "weight": 0.2,
      "evidence": ["fact_123", "fact_456"] }
  ],
  "reasons":    [{ "text_key": "...", "fact_ids": ["fact_123"] }],
  "tradeoffs":  [{ "text_key": "...", "fact_ids": ["fact_789"] }],
  "unknowns":   [{ "dimension": "education", "missing": ["kindergarten_capacity"] }]
}
```

## 4. Matching algorithm (suggested approach)

Keep it **deterministic, explainable and testable**. No LLM in the scoring loop.

1. **Hard constraints filter.** Non-negotiables from the profile (e.g. "hospital ≤ 30 min", "school for a 7-year-old", "train to Sofia") remove places outright. Keep the reason for each removal so the UI can say "excluded because…".
2. **Metric normalization.** Each metric is mapped to 0..1 with a documented function per metric (thresholds, log scale for distances, etc.).
3. **Dimension scores.** The 7 dimensions (transport, healthcare, education, amenities, nature, employment, demographics) are weighted averages of their metrics.
4. **User weights.** Profile answers become dimension weights. Quick Match gives coarse weights; Detailed Match refines them.
5. **Catchment for villages.** A village's metric = best value reachable within X minutes, so a nearby town's hospital counts, marked `derived`.
6. **Uncertainty.** Missing data lowers a **confidence** value and appears in `unknowns`. It does not silently lower or raise the score.
7. **Swipe feedback (optional).** Likes/dislikes nudge weights slightly. This makes a good demo but isn't essential.

Include golden tests: a few hand-made profiles with expected top-3 results.

## 5. Data model (sketch)

```
settlement(ekatte PK, name_bg, name_en, type town|village, municipality, district,
           lat, lon, parent_town_ekatte NULL, population)
fact(id PK, ekatte FK, dimension, metric, value_num, value_text, unit,
     status verified|derived|estimated, source_id FK, retrieved_at, method, notes)
source(id PK, name, url, licence, retrieved_at)
session(id PK, created_at)
profile(session_id PK FK, completeness quick|detailed, answers JSONB, weights JSONB, constraints JSONB, updated_at)
swipe(session_id FK, ekatte FK, action, created_at)
ai_cache(key PK, payload JSONB, created_at)    -- cached simulations/explanations
```

## 6. Open questions for the BE team

- Python or TypeScript? Where do we host?
- How do we turn Quick Match answers into weights? (needs product input)
- How many metrics per dimension can we realistically get with good data?
- Do we generate the relocation plan with rules + templates, with an LLM, or with both?
