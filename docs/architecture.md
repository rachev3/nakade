# nakade — Architecture

Status: **preparation**. This document is the map. Each part links to its own doc.
Parts marked *Agreed* are settled; parts marked *Proposal* are suggestions for the owning team to discuss and decide.

| Area | Owner | Status | Doc |
|---|---|---|---|
| Frontend (UI/UX) | rachev3 | Agreed | [frontend.md](frontend.md) |
| DevOps, environments, workflow | rachev3 | Agreed | [devops.md](devops.md) |
| Backend API + matching algorithm | BE team | Proposal | [proposals/backend.md](proposals/backend.md) |
| Data pipeline + sources | Data team | Proposal | [proposals/data-pipeline.md](proposals/data-pipeline.md) |
| AI layer | rachev3 + BE | Proposal | [proposals/ai.md](proposals/ai.md) |

Product context: [product-context.md](product-context.md).

## 1. What drives the design

1. **Small, slow-changing data.** ~30 towns × 3–5 villages ≈ 150 settlements. Services, schools and transport change over months. All heavy data work happens **offline**. The live app only reads prepared data.
2. **Trust is the product.** "Never invent local facts" is an architectural requirement. Every value carries its source, retrieval date and status: `verified`, `derived` or `estimated`. That provenance flows unchanged from the pipeline through the API to the UI.
3. **The frontend is the product.** Swipe discovery and "Try your new life" are the signature features, so they get first-class engineering.
4. **AI narrates; it never decides.** Matching and scoring are deterministic and testable. AI turns structured results into language and must cite the facts it uses.

## 2. System overview

```
 SOURCES               OFFLINE PIPELINE                                  LIVE APP
 ───────               ────────────────                                  ────────
 APIs   ─┐                                                            ┌─ web  (React SPA, Cloudflare Worker)
 CSV    ─┼─► ingest raw ─► normalize ─► resolve to ─► enrich ─► DB ◄──┤        nakade.app / dev.nakade.app
 scrape ─┘   snapshots     per-source   EKATTE code   travel     │    │
             (immutable)   adapters                   times,     │    └─ api  (matching, profiles, AI calls)
                                                      catchment  │             │
                                                                 │             └─► LLM via Cloudflare AI Gateway
                        every fact: value · unit · source · retrieved_at · status
```

- **web**: the single-page app. It talks only to `/api/*`.
- **api**: owns the matching algorithm, user profiles and sessions, and all LLM calls (API keys never reach the browser).
- **pipeline**: runs on demand or on a schedule, never on a user request. It writes the location dataset to the DB.
- **DB**: holds two kinds of data. Read-only *location facts* come from the pipeline. Read-write *user data* (profile, swipes, saved places) comes from the app.

## 3. Repository layout (monorepo)

```
apps/web/          frontend + its wrangler.jsonc → frontend.md
apps/api/          backend API + algorithm       → proposals/backend.md
data/pipeline/     ingestion + normalization     → proposals/data-pipeline.md
data/sources.md    catalogue of data sources
docs/              architecture, product, proposals
.github/           CI workflows, PR template
package.json       pnpm workspace root (apps/*)
```

## 4. Contracts between teams

The teams work in parallel. These contracts are where they meet:

1. **API contract: OpenAPI.** The backend publishes `openapi.json`. The frontend generates a typed client from it and mocks it while the backend is in progress. Changing the contract = a PR that both sides review.
2. **Fact contract: provenance schema.** Defined in [proposals/data-pipeline.md](proposals/data-pipeline.md#4-the-fact-record). Pipeline, API and UI all use the same shape.
3. **Settlement identity: EKATTE code.** The official Bulgarian settlement code is the primary key everywhere: DB, API, URLs.

## 5. Decisions log

| # | Decision | Status |
|---|---|---|
| 1 | Monorepo, separate apps for web / api / pipeline | Agreed |
| 2 | Frontend: React + Vite + TypeScript SPA on Cloudflare Workers | Agreed |
| 3 | Branch flow `feature → dev → main`, `main` only receives from `dev` | Agreed |
| 4 | `nakade.app` = production (`main`), `dev.nakade.app` = integration (`dev`) | Agreed |
| 5 | Every fact carries provenance and status | Agreed (product requirement) |
| 6 | EKATTE as settlement ID | Proposal |
| 7 | Backend language/runtime: Python (FastAPI) vs TypeScript (Hono on Workers) | Open: BE team |
| 8 | Database: Postgres (Neon) vs D1 | Open: follows #7 |
| 9 | Pipeline in Python | Proposal |
| 10 | No user accounts for the hackathon; anonymous sessions | Proposal |
| 11 | LLM calls only from the backend, through Cloudflare AI Gateway | Proposal |
