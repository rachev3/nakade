# DevOps

Owner: rachev3 · Status: **Agreed**

## 1. Branches

```
feat/*, fix/*, chore/*  ──PR──►  dev  ──release PR──►  main
                                 │                       │
                          dev.nakade.app            nakade.app
```

| Branch | Purpose | Receives from | Deploys to |
|---|---|---|---|
| `main` | Production. Always deployable | **only `dev`** (release PR) | https://nakade.app |
| `dev` | Integration and testing. Default branch | feature branches (PR) | https://dev.nakade.app |
| `feat/…`, `fix/…`, `chore/…` | Day-to-day work, branched from `dev` | n/a | — |

Rules:
- Branch from `dev`, open the PR into `dev`. Use **squash merge** into `dev`.
- To release, open a PR **`dev` → `main`** and merge it with a **merge commit**, never squash. Squashing would make `main` and `dev` diverge.
- No direct pushes to `main` or `dev`. A CI check (`branch-flow`) fails any PR into `main` whose source is not `dev`.
- Hotfixes follow the same path: `fix/*` → `dev` → `main`.
- Branch names: `feat/swipe-deck`, `fix/profile-reset`, `chore/ci-cache`, `data/nsi-population`.

## 2. Environments

| Env | URL | Branch | Cloudflare Worker | Notes |
|---|---|---|---|---|
| Production | nakade.app (www → apex 301) | `main` | `nakade` | |
| Dev | dev.nakade.app | `dev` | `nakade-dev` | `noindex`; shared test data |
| Local | localhost | any | `wrangler dev` / Vite | |

Both Workers are deployed by **Cloudflare Workers Builds**, connected to `rachev3/nakade`:
- `nakade`: builds on push to `main`, runs `npx wrangler deploy`
- `nakade-dev`: builds on push to `dev`, runs `npx wrangler deploy --env dev`

Environment config lives in `wrangler.jsonc` (`env.dev`).

## 3. Domain & edge (Cloudflare zone `nakade.app`)

- DNS records are created automatically by Worker custom domains (`nakade.app`, `www.nakade.app`, `dev.nakade.app`)
- SSL mode: Full (strict). Always Use HTTPS: on
- Redirect rule: `www.nakade.app/*` → `https://nakade.app/*` (301, keeps the query string)
- Reserved for later: `api.nakade.app` (only if the API is not proxied through `/api/*` on the web Worker)

## 4. CI (GitHub Actions)

| Workflow | Trigger | What |
|---|---|---|
| `branch-flow` | PR into `main` | Fails unless the head branch is `dev` |
| `web` *(when scaffolded)* | PR / push touching `apps/web/**` | lint, typecheck, unit tests, build |
| `api` *(when chosen)* | PR / push touching `apps/api/**` | lint, tests, OpenAPI drift check |
| `pipeline` *(when chosen)* | manual / schedule | run ingestion, validate output, load DB |

Deployment is done by Cloudflare Workers Builds, not by GitHub Actions. CI only validates.

## 5. Secrets & config

- Never commit secrets. `.env*` and `.dev.vars*` are git-ignored.
- Runtime secrets (LLM keys, DB URLs) go in **Cloudflare Worker secrets** per environment: `wrangler secret put NAME [--env dev]`.
- CI secrets (if needed) go in **GitHub Actions secrets**.
- Each environment has its own DB and its own keys. Dev never points at production data.

## 6. Observability

- Workers Logs / Observability enabled per Worker
- AI Gateway logs for every LLM call: cost, latency, cache hits (see [proposals/ai.md](proposals/ai.md))
- Pipeline runs write a run log: source, row counts, warnings

## 7. Later (not needed now)

- PR preview URLs for feature branches
- Cloudflare Access in front of `dev.nakade.app`
- Uptime check on `nakade.app`
