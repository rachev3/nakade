/**
 * Toy matcher for the mock API. NOT the real algorithm (that belongs to the backend team, see
 * docs/proposals/backend.md §4). It only produces plausibly-shaped, deterministic results so the
 * UI has something to render: weights from priorities, constraint filtering, reasons,
 * trade-offs and unknowns.
 */
import type { Dimension, Explanation, Match, MustHave, Profile, Unknown } from '../types'
import { DIMENSIONS, factId, factsFor, type Lang, type PlaceFixture, toSummary } from './fixtures'

export function weightsFor(profile: Profile): Record<Dimension, number> {
  const { priorities = [], compromises = [] } = profile.answers
  const raw = Object.fromEntries(
    DIMENSIONS.map((d) => {
      let w = 1
      if (priorities.includes(d)) w = 3
      if (compromises.includes(d)) w = 0.4
      return [d, w]
    }),
  ) as Record<Dimension, number>
  const total = Object.values(raw).reduce((a, b) => a + b, 0)
  return Object.fromEntries(DIMENSIONS.map((d) => [d, raw[d] / total])) as Record<Dimension, number>
}

function factValue(place: PlaceFixture, metric: string) {
  return place.facts.find((f) => f[1] === metric)?.[2] ?? null
}

const CONSTRAINTS: Record<MustHave, (p: PlaceFixture) => boolean | null> = {
  hospital_30min: (p) => {
    const v = factValue(p, 'drive_min_to_hospital')
    return typeof v === 'number' ? v <= 30 : null
  },
  school: (p) => {
    const schools = factValue(p, 'schools')
    const drive = factValue(p, 'drive_min_to_school')
    if (typeof schools === 'number' && schools > 0) return true
    if (typeof drive === 'number') return drive <= 30
    return schools === null ? null : false
  },
  train_to_sofia: (p) => {
    const v = factValue(p, 'train_station')
    return v === null ? null : v === 'yes'
  },
  fast_internet: (p) => {
    const v = factValue(p, 'broadband_coverage_pct')
    return typeof v === 'number' ? v >= 75 : null
  },
  pharmacy: (p) => {
    const v = factValue(p, 'drive_min_to_hospital')
    return typeof v === 'number' ? v <= 20 : null
  },
  kindergarten: (p) => {
    const v = factValue(p, 'kindergarten_capacity')
    return typeof v === 'number' ? v > 0 : null
  },
}

const CONSTRAINT_METRIC: Record<MustHave, string> = {
  hospital_30min: 'drive_min_to_hospital',
  school: 'schools',
  train_to_sofia: 'train_station',
  fast_internet: 'broadband_coverage_pct',
  pharmacy: 'drive_min_to_hospital',
  kindergarten: 'kindergarten_capacity',
}

export function matchPlace(place: PlaceFixture, profile: Profile, lang: Lang): Match {
  const ekatte = place.summary.ekatte
  const weights = weightsFor(profile)
  const facts = factsFor(place)

  const dimensions = DIMENSIONS.map((key) => ({
    key,
    score: place.scores[key],
    weight: Number(weights[key].toFixed(3)),
    evidence: facts.filter((f) => f.dimension === key && f.value !== null).map((f) => f.id),
  }))

  const known = dimensions.filter((d) => d.score !== null)
  const knownWeight = known.reduce((a, d) => a + d.weight, 0)
  const score = knownWeight
    ? known.reduce((a, d) => a + (d.score ?? 0) * d.weight, 0) / knownWeight
    : 0
  const confidence = knownWeight

  const excluded_because: Explanation[] = []
  for (const mh of profile.answers.must_haves ?? []) {
    if (CONSTRAINTS[mh](place) === false) {
      excluded_because.push({
        text_key: `constraint.${mh}`,
        fact_ids: [factId(ekatte, CONSTRAINT_METRIC[mh])],
      })
    }
  }

  const ranked = [...known].sort((a, b) => (b.score ?? 0) * b.weight - (a.score ?? 0) * a.weight)
  const reasons: Explanation[] = ranked
    .filter((d) => (d.score ?? 0) >= 0.6)
    .slice(0, 3)
    .map((d) => ({ text_key: `reason.${d.key}`, fact_ids: d.evidence }))

  const tradeoffs: Explanation[] = [...known]
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .filter((d) => (d.score ?? 1) < 0.5)
    .slice(0, 2)
    .map((d) => ({ text_key: `tradeoff.${d.key}`, fact_ids: d.evidence }))

  const unknowns: Unknown[] = DIMENSIONS.flatMap((dimension) => {
    const missing = facts
      .filter((f) => f.dimension === dimension && f.value === null)
      .map((f) => f.metric)
    const noScore = place.scores[dimension] === null
    return missing.length || noScore ? [{ dimension, missing }] : []
  })

  return {
    ekatte,
    settlement: toSummary(place, lang),
    score: Number(score.toFixed(3)),
    confidence: Number(confidence.toFixed(3)),
    passes_constraints: excluded_because.length === 0,
    excluded_because,
    dimensions,
    reasons,
    tradeoffs,
    unknowns,
  }
}

export function rank(matches: Match[]) {
  return [...matches].sort(
    (a, b) => Number(b.passes_constraints) - Number(a.passes_constraints) || b.score - a.score,
  )
}
