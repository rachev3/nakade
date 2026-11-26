# Frontend

Owner: rachev3 · Status: **Agreed** · Code: [`apps/web/`](../apps/web/README.md) (skeleton scaffolded, running on mocks)

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **React 19 + TypeScript (strict)** | Team familiarity, ecosystem for gestures and animation |
| Build | **Vite** | Fast dev server, simple static output |
| Routing | **React Router** (data mode) | Loaders/actions, nested layouts, no framework lock-in |
| Server state | **TanStack Query** | Caching, retries, optimistic swipes |
| Client state | **Zustand** | Onboarding progress, swipe deck, simulation state. Small and explicit |
| Styling | **Tailwind CSS v4** with design tokens | Fast iteration; tokens keep light/dark consistent |
| UI primitives | **Radix UI** (via shadcn/ui, copied into repo) | Accessible dialogs, sheets, sliders, tabs |
| Animation & gestures | **Motion** (`motion/react`) | Swipe cards, drag, layout transitions, simulation scenes |
| Maps | **MapLibre GL** + OSM-based vector tiles | Free, no vendor key needed to start |
| Forms & validation | **React Hook Form + Zod** | Adaptive questionnaire; Zod also validates API responses |
| API client | **openapi-typescript + openapi-fetch** | Types generated from the backend's OpenAPI spec |
| Mocking | **MSW** | Build the UI before the backend exists |
| i18n | **react-i18next**, Bulgarian default + English | Market is Bulgaria; English for judges and expats |
| Tests | **Vitest + Testing Library**; **Playwright** smoke tests | Unit for logic, e2e for the two journeys. *Deferred for the hackathon, not set up yet* |
| Lint/format | **ESLint + Prettier** | Standard |
| Package manager | **pnpm** workspaces | Monorepo-friendly |

**Hosting:** Cloudflare Worker with static assets, `not_found_handling: "single-page-application"`. The same Worker proxies `/api/*` to the backend, so the browser sees one origin: no CORS, and session cookies stay first-party.

## 2. Screens and routes

Both journeys share one route tree. The entry point only sets where the user starts.

| Route | Screen | Journey |
|---|---|---|
| `/` | Landing: "I know where" vs "Help me find my place" | both |
| `/start/known` | Pick current location + destination | A |
| `/start/discover` | Describe the life you want (free text + chips) | B |
| `/profile/quick` | Quick Match, ~5 steps | both |
| `/profile/detailed` | Detailed Match, adaptive, resumable | both |
| `/discover` | Swipe deck | B (A: "see alternatives") |
| `/places/:ekatte` | Place detail: fit, trade-offs, facts with sources, map | both |
| `/places/:ekatte/try` | Try Your New Life simulation | both |
| `/compare?ids=…` | Side-by-side comparison of saved places | both |
| `/saved` | Saved / liked places | both |
| `/plan/:ekatte` | Personalized relocation plan / checklist | both |

**Choosing depth:** both start pages (`/start/known`, `/start/discover`) let the user pick Quick Match (5 questions) or Detailed Match (up to 13) before the questions start.

**Progressive profiling:** one profile object with a `completeness` level (`quick` → `detailed`). "Upgrade to Detailed Match" adds steps and never resets anything. Answers, swipes and saved places are kept and re-scored.

## 3. Folder structure (`apps/web/src`)

```
app/            router, providers, layouts, error boundaries
features/
  onboarding/   quick + detailed flows, adaptive step engine
  discover/     swipe deck, card, gestures
  place/        detail page, fit breakdown, trade-offs
  simulation/   Try Your New Life scenes and timeline
  compare/
  plan/
components/     shared UI (Fact, Scenario, ScoreBar, MapView, ...)
api/            generated types, client, query hooks, MSW handlers
lib/            utils, formatting, i18n setup
styles/         tokens, Tailwind entry
locales/        bg/, en/
```

Rule: features import from `components/`, `api/` and `lib/`, never from each other.

## 4. Trust in the UI: facts vs scenarios

This is the most important UI rule in the product.

- **`<Fact>`** renders an API fact (`value`, `unit`, `status`, `source`, `retrieved_at`) with a status marker:
  - `verified`: solid. Source shown on tap or hover.
  - `derived`: shows how it was calculated (e.g. "drive time via OSRM").
  - `estimated`: visibly marked as an estimate, never styled like a verified number.
- **`<Scenario>`** renders AI or simulation narrative that is *hypothetical*. It has a distinct style (e.g. italic, tinted, "imagined" label) so it cannot be mistaken for data.
- **Missing data** is shown as "No reliable data", never hidden and never filled with a guess.
- Every recommendation shows **why** (top matching dimensions), **trade-offs**, and **what we don't know**.

## 5. UX principles → implementation

| Principle | How |
|---|---|
| Interactive first | One question per screen, chips/sliders/cards instead of long forms |
| Mobile first | Designed at 375px; swipe is touch-native, desktop gets drag + buttons |
| Accessible | Every swipe has button and keyboard equivalents (←/→/S); `prefers-reduced-motion` respected; WCAG AA contrast |
| Fast | Route-level code splitting; maps and simulation lazy-loaded; target < 200 KB JS for the first screen |
| Resumable | Profile progress persisted server-side by session; a reload never loses progress |
| Light/dark | Tokens on `:root` with dark overrides |
| Calm motion | One easing curve, 150–450ms, ≤ 24px movement (`apps/web/src/lib/motion.ts`). Page fade-in, step slides, stacked swipe deck, score bars filling, theme crossfade. All of it switches off with `prefers-reduced-motion` |

## 6. What the frontend needs from the API

The backend team owns the actual design (see [proposals/backend.md](proposals/backend.md)). The frontend needs:

- Settlement list + detail by EKATTE, including facts with provenance and coordinates
- Session create/resume; profile read/update (partial updates for progressive profiling)
- Match results for the current profile: ranked list, per-dimension scores, reasons, trade-offs, unknowns
- Record swipe (like / dislike / save)
- Simulation for (settlement, profile): ordered scenes, each tagged fact or scenario with fact IDs
- Relocation plan for (settlement, profile)

Until endpoints exist, MSW handlers in `apps/web/src/api/mocks` serve fixtures shaped like the OpenAPI spec. The frontend wrote a **draft** spec, [`apps/web/src/api/openapi.yaml`](../apps/web/src/api/openapi.yaml), from the sketch in the backend proposal. The backend team owns the contract and replaces it with their own. MSW runs in local dev and in the deployed build (`VITE_API_MODE=mock`, the default) until the backend exists. While it does, the UI shows a "Demo data" badge and tags every fixture fact as DEMO, because fixture values are placeholders.

## 7. Next steps

Done (skeleton): `apps/web` scaffold, `wrangler.jsonc` moved into it, neutral design tokens + base layout, `<Fact>` / `<Scenario>`, MSW mock API with 5 towns + 2 villages, the full clickable journey (landing → start → Quick/Detailed Match → swipe deck → place detail → simulation stub → saved / compare / plan stubs).

Next:
1. ~~Visual direction~~ Done: "Rodopi calm" (forest green + clay on cream, Lora + Sofia Sans, light and dark). See `apps/web/src/styles/tokens.css`
2. MapLibre map on place detail
3. Swipe-card images (licensed) and copy
4. Switch to the real API when the backend publishes its OpenAPI spec
5. Tests + `web` CI workflow (deferred for the hackathon)

Small implementation notes:
- TypeScript is pinned to 5.9: typescript-eslint and openapi-typescript don't support TS 7 yet.
- Landing and the two start pages live in `features/start/`; the saved list lives in `features/compare/`.
