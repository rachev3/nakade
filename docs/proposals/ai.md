# Proposal — AI layer

Owners: rachev3 + BE team · Status: **Proposal, for discussion**

## 1. Rule zero

**AI narrates, it never decides and never supplies facts.** Scores, rankings and facts come from the algorithm and the dataset. The LLM only turns structured data into language, and every factual statement it makes must point to a fact ID we already have.

## 2. Where AI is used

| # | Use | When | Notes |
|---|---|---|---|
| 1 | **Free text → profile** ("peaceful, nature, but hospital within 30 min") | Onboarding, journey B | Structured output: weights, constraints, follow-up questions. The user confirms before it's saved |
| 2 | **Adaptive onboarding**: pick the next most useful question | Detailed Match | Chooses from a *fixed question bank*. It does not invent questions |
| 3 | **Match explanations**: why it fits, trade-offs, unknowns | Place detail, swipe card | Input = `Match` + facts. Output cites fact IDs |
| 4 | **Try Your New Life simulation**: a day in the place | Simulation | Each scene is tagged `fact` (with fact IDs) or `scenario` |
| 5 | **Swipe card copy**: short hook per settlement | Pre-generated in a batch | ~150 places × 2 languages, generated once and reviewed. No runtime cost |
| 6 | **Relocation plan** wording | Plan page | Checklist items come from rules/templates; the LLM personalizes the wording |

## 3. Grounding contract

1. The backend builds a **facts bundle** for the request: only the relevant facts, with IDs.
2. The LLM is called with **structured output** (JSON schema). Each statement has `kind: fact | scenario` and, for `fact`, `fact_ids[]`.
3. The backend **validates** the response: cited IDs must exist in the bundle, and numbers in fact statements must match the cited values. On failure it retries once, then falls back to template text.
4. The UI renders `fact` statements with `<Fact>` styling and `scenario` statements with `<Scenario>` styling (see [../frontend.md](../frontend.md#4-trust-in-the-ui-facts-vs-scenarios)).

## 4. Infrastructure

- All calls go from the backend through **Cloudflare AI Gateway**: logging, caching, rate limiting, spend caps, model fallback.
- **Cache** simulations and explanations by `(ekatte, profile-archetype hash, language)`. Many users have similar profiles.
- Prompts live in the repo (`apps/api/prompts/`), versioned and reviewed like code.
- Model choice is decided when we build this. Plan for a fast model for live calls and a cheaper one for batch generation.

## 5. Evaluation

- A small eval set: ~10 profiles × ~5 places. Check that there are no uncited facts, no wrong numbers, consistent tone, and both languages.
- Run it whenever a prompt or the model changes.

## 6. Open questions

- Which uses are in the hackathon scope? (Suggested: 1, 3, 4, 5)
- Bulgarian-language quality: test early with real prompts
- Budget per day / per session
