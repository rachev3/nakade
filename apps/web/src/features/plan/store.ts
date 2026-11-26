import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Checklist ticks, per place. Local only for now; could move to the API later. */
interface PlanState {
  done: Record<string, string[]>
  toggle: (ekatte: string, itemId: string) => void
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      done: {},
      toggle: (ekatte, itemId) =>
        set((s) => {
          const current = s.done[ekatte] ?? []
          const next = current.includes(itemId)
            ? current.filter((x) => x !== itemId)
            : [...current, itemId]
          return { done: { ...s.done, [ekatte]: next } }
        }),
    }),
    { name: 'nakade.plan' },
  ),
)
