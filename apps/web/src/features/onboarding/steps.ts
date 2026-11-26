/**
 * Adaptive step engine (one question per screen). Quick Match = the 10 `quick` steps; Detailed
 * Match = every step (10 + 20), pre-filled from the same profile, so upgrading never loses anything.
 * `when` hides steps that don't apply to this person (e.g. kids' ages only for families).
 * Every answer feeds the matching engine (apps/api/ENGINE.md lists which data each one uses).
 */
import type { ProfileAnswers } from '@/api/types'
import type { Flow } from '@/lib/journey'

const DIMENSIONS = [
  'transport',
  'healthcare',
  'education',
  'amenities',
  'nature',
  'employment',
  'demographics',
] as const

/** The 27 oblast centres (EKATTE) the API accepts as `current_location` (apps/api/src/engine/origins.js). */
const ORIGINS = [
  '68134',
  '56784',
  '10135',
  '07079',
  '63427',
  '68850',
  '56722',
  '72624',
  '83510',
  '55871',
  '67338',
  '87374',
  '77195',
  '04279',
  '10447',
  '12259',
  '14218',
  '55155',
  '10971',
  '40909',
  '41112',
  '48489',
  '73626',
  '66425',
  '43952',
  '61710',
  '67653',
] as const

export type StepKind =
  | { type: 'single'; options: readonly string[]; optionKey: string }
  | { type: 'multi'; options: readonly string[]; optionKey: string; max?: number }
  | { type: 'boolean' }
  | { type: 'number'; min: number; max: number }
  | { type: 'numberList'; min: number; max: number }

export interface StepDef {
  id: string
  /** i18n key under onboarding.steps */
  i18n: string
  field: keyof ProfileAnswers
  flow: Flow
  kind: StepKind
  when?: (a: ProfileAnswers) => boolean
}

const single = (options: readonly string[], optionKey: string): StepKind => ({
  type: 'single',
  options,
  optionKey,
})
const yesNo: StepKind = { type: 'boolean' }

export const STEPS: StepDef[] = [
  // ── Quick Match (10) ──────────────────────────────────────────────
  {
    id: 'household',
    i18n: 'household',
    field: 'household',
    flow: 'quick',
    kind: single(['single', 'couple', 'family_kids', 'retired', 'other'], 'household'),
  },
  {
    id: 'origin',
    i18n: 'origin',
    field: 'current_location',
    flow: 'quick',
    kind: single(ORIGINS, 'origin'),
  },
  {
    id: 'homeDistance',
    i18n: 'homeDistance',
    field: 'max_home_distance',
    flow: 'quick',
    kind: single(['up_to_1h', 'up_to_2h', 'up_to_4h', 'any'], 'homeDistance'),
  },
  {
    id: 'work',
    i18n: 'work',
    field: 'work_mode',
    flow: 'quick',
    kind: single(['remote', 'hybrid', 'office', 'self_employed', 'looking', 'not_working'], 'work'),
  },
  { id: 'car', i18n: 'car', field: 'has_car', flow: 'quick', kind: yesNo },
  {
    id: 'placeType',
    i18n: 'placeType',
    field: 'place_type',
    flow: 'quick',
    kind: single(['village', 'small_town', 'city', 'any'], 'placeType'),
  },
  {
    id: 'community',
    i18n: 'community',
    field: 'community',
    flow: 'quick',
    kind: single(['quiet', 'lively', 'either'], 'community'),
  },
  {
    id: 'nature',
    i18n: 'nature',
    field: 'nature',
    flow: 'quick',
    kind: {
      type: 'multi',
      options: ['mountains', 'forest', 'water', 'sea', 'plains'],
      optionKey: 'nature',
    },
  },
  {
    id: 'priorities',
    i18n: 'priorities',
    field: 'priorities',
    flow: 'quick',
    kind: { type: 'multi', options: DIMENSIONS, optionKey: 'dimension', max: 3 },
  },
  {
    id: 'must_haves',
    i18n: 'mustHaves',
    field: 'must_haves',
    flow: 'quick',
    kind: {
      type: 'multi',
      options: [
        'hospital_30min',
        'school',
        'train_to_sofia',
        'fast_internet',
        'pharmacy',
        'kindergarten',
      ],
      optionKey: 'mustHaves',
    },
  },

  // ── Detailed Match (+20, adaptive) ────────────────────────────────
  {
    id: 'housing',
    i18n: 'housing',
    field: 'housing',
    flow: 'detailed',
    kind: single(['rent', 'buy', 'undecided'], 'housing'),
  },
  {
    id: 'budget',
    i18n: 'budget',
    field: 'budget_eur_month',
    flow: 'detailed',
    kind: { type: 'number', min: 0, max: 10000 },
    when: (a) => a.housing !== 'buy',
  },
  {
    id: 'buyBudget',
    i18n: 'buyBudget',
    field: 'buy_budget_eur',
    flow: 'detailed',
    kind: { type: 'number', min: 0, max: 5000000 },
    when: (a) => a.housing === 'buy',
  },
  {
    id: 'homeType',
    i18n: 'homeType',
    field: 'home_type',
    flow: 'detailed',
    kind: single(['house', 'apartment', 'either'], 'homeType'),
    when: (a) => a.housing === 'buy',
  },
  {
    id: 'commute',
    i18n: 'commute',
    field: 'max_commute_min',
    flow: 'detailed',
    kind: { type: 'number', min: 0, max: 240 },
    when: (a) => a.work_mode === 'office' || a.work_mode === 'hybrid',
  },
  {
    id: 'officeDays',
    i18n: 'officeDays',
    field: 'office_days',
    flow: 'detailed',
    kind: { type: 'number', min: 0, max: 5 },
    when: (a) => a.work_mode === 'hybrid',
  },
  {
    id: 'internetNeeds',
    i18n: 'internetNeeds',
    field: 'internet_needs',
    flow: 'detailed',
    kind: single(['basic', 'video_calls', 'heavy'], 'internetNeeds'),
    when: (a) =>
      a.work_mode === 'remote' || a.work_mode === 'hybrid' || a.work_mode === 'self_employed',
  },
  {
    id: 'partnerJob',
    i18n: 'partnerJob',
    field: 'partner_job',
    flow: 'detailed',
    kind: yesNo,
    when: (a) => a.household === 'couple' || a.household === 'family_kids',
  },
  {
    id: 'kids',
    i18n: 'kids',
    field: 'kids_ages',
    flow: 'detailed',
    kind: { type: 'numberList', min: 0, max: 18 },
    when: (a) => a.household === 'family_kids',
  },
  {
    id: 'healthcare',
    i18n: 'healthcare',
    field: 'healthcare_needs',
    flow: 'detailed',
    kind: single(['none', 'regular', 'specialist'], 'healthcare'),
  },
  { id: 'walkable', i18n: 'walkable', field: 'walkable', flow: 'detailed', kind: yesNo },
  {
    id: 'publicTransport',
    i18n: 'publicTransport',
    field: 'public_transport',
    flow: 'detailed',
    kind: single(['daily', 'sometimes', 'never'], 'publicTransport'),
  },
  {
    id: 'sofiaTrips',
    i18n: 'sofiaTrips',
    field: 'sofia_trips',
    flow: 'detailed',
    kind: single(['weekly', 'monthly', 'rarely'], 'sofiaTrips'),
  },
  {
    id: 'visitHome',
    i18n: 'visitHome',
    field: 'visit_home',
    flow: 'detailed',
    kind: single(['weekly', 'monthly', 'rarely'], 'visitHome'),
    when: (a) => !!a.current_location,
  },
  {
    id: 'cold',
    i18n: 'cold',
    field: 'cold_tolerance',
    flow: 'detailed',
    kind: single(['love_winter', 'fine', 'prefer_mild'], 'cold'),
  },
  { id: 'heating', i18n: 'heating', field: 'heating_costs', flow: 'detailed', kind: yesNo },
  {
    id: 'goingOut',
    i18n: 'goingOut',
    field: 'going_out',
    flow: 'detailed',
    kind: single(['often', 'sometimes', 'rarely'], 'goingOut'),
  },
  { id: 'pets', i18n: 'pets', field: 'pets', flow: 'detailed', kind: yesNo },
  {
    id: 'depopulation',
    i18n: 'depopulation',
    field: 'depopulation',
    flow: 'detailed',
    kind: single(['important', 'somewhat', 'not_important'], 'depopulation'),
  },
  {
    id: 'compromises',
    i18n: 'compromises',
    field: 'compromises',
    flow: 'detailed',
    kind: { type: 'multi', options: DIMENSIONS, optionKey: 'dimension' },
  },
]

export function stepsFor(flow: Flow, answers: ProfileAnswers) {
  return STEPS.filter(
    (s) => (flow === 'detailed' || s.flow === 'quick') && (!s.when || s.when(answers)),
  )
}

export function isAnswered(step: StepDef, answers: ProfileAnswers) {
  const v = answers[step.field]
  return v !== undefined && v !== null
}

/** Resume: the stored step if still visible, else the first unanswered one, else the first. */
export function resumeIndex(steps: StepDef[], answers: ProfileAnswers, storedId?: string) {
  const stored = steps.findIndex((s) => s.id === storedId)
  if (stored >= 0) return stored
  const firstOpen = steps.findIndex((s) => !isAnswered(s, answers))
  return firstOpen >= 0 ? firstOpen : 0
}
