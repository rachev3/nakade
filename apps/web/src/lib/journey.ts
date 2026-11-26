/**
 * Client-side journey state (Zustand, persisted). The profile itself lives on the server
 * (PATCH /api/profile); this only remembers where the user is in the flow so a reload resumes.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Journey = 'known' | 'discover'
export type Flow = 'quick' | 'detailed'

interface JourneyState {
  journey: Journey | null
  destination: string | null
  /** Current step id per flow, for resuming */
  stepId: Partial<Record<Flow, string>>
  start: (journey: Journey, destination?: string | null) => void
  setStep: (flow: Flow, stepId: string | undefined) => void
  reset: () => void
}

export const useJourneyStore = create<JourneyState>()(
  persist(
    (set) => ({
      journey: null,
      destination: null,
      stepId: {},
      start: (journey, destination = null) => set({ journey, destination }),
      setStep: (flow, stepId) => set((s) => ({ stepId: { ...s.stepId, [flow]: stepId } })),
      reset: () => set({ journey: null, destination: null, stepId: {} }),
    }),
    { name: 'nakade.journey' },
  ),
)

/** Where to go once a profile flow is finished. */
export function afterProfilePath(journey: Journey | null, destination: string | null) {
  return journey === 'known' && destination ? `/places/${destination}` : '/discover'
}

/**
 * Where to go after a start page, given the profile depth the user picked.
 * Never repeats a flow that is already done, and never downgrades: picking Quick after a
 * Detailed Match just goes to results.
 */
export function nextAfterStart(
  flow: Flow,
  completeness: 'none' | 'quick' | 'detailed' | undefined,
  resultsPath: string,
) {
  if (completeness === 'detailed') return resultsPath
  if (flow === 'detailed') return '/profile/detailed'
  return completeness === 'quick' ? resultsPath : '/profile/quick'
}
