/**
 * Adaptive step engine (one question per screen). Quick Match = the `quick` steps; Detailed
 * Match = every step, pre-filled from the same profile, so upgrading never loses anything.
 * `when` hides steps that don't apply to this person (e.g. kids' ages only for families).
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

export const STEPS: StepDef[] = [
  // ── Quick Match (~5) ──────────────────────────────────────────────
  {
    id: 'household',
    i18n: 'household',
    field: 'household',
    flow: 'quick',
    kind: {
      type: 'single',
      options: ['single', 'couple', 'family_kids', 'retired', 'other'],
      optionKey: 'household',
    },
  },
  {
    id: 'work',
    i18n: 'work',
    field: 'work_mode',
    flow: 'quick',
    kind: {
      type: 'single',
      options: ['remote', 'hybrid', 'office', 'self_employed', 'looking', 'not_working'],
      optionKey: 'work',
    },
  },
  { id: 'car', i18n: 'car', field: 'has_car', flow: 'quick', kind: { type: 'boolean' } },
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
  // ── Detailed Match (adaptive) ─────────────────────────────────────
  {
    id: 'housing',
    i18n: 'housing',
    field: 'housing',
    flow: 'detailed',
    kind: { type: 'single', options: ['rent', 'buy', 'undecided'], optionKey: 'housing' },
  },
  {
    id: 'budget',
    i18n: 'budget',
    field: 'budget_eur_month',
    flow: 'detailed',
    kind: { type: 'number', min: 0, max: 10000 },
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
    kind: { type: 'single', options: ['none', 'regular', 'specialist'], optionKey: 'healthcare' },
  },
  {
    id: 'nature',
    i18n: 'nature',
    field: 'nature',
    flow: 'detailed',
    kind: {
      type: 'multi',
      options: ['mountains', 'forest', 'water', 'sea', 'plains'],
      optionKey: 'nature',
    },
  },
  {
    id: 'community',
    i18n: 'community',
    field: 'community',
    flow: 'detailed',
    kind: { type: 'single', options: ['quiet', 'lively', 'either'], optionKey: 'community' },
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
