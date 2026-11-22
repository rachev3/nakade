/**
 * TanStack Query hooks over the typed client. Query keys include the UI language because the
 * API localises free text.
 */
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, unwrap } from './client'
import type { MatchRequest, Profile, ProfilePatch, Swipe } from './types'

export const keys = {
  profile: ['profile'] as const,
  settlements: (lang: string) => ['settlements', lang] as const,
  settlement: (ekatte: string, lang: string) => ['settlement', ekatte, lang] as const,
  matches: (req: MatchRequest, lang: string) => ['matches', req, lang] as const,
  saved: (lang: string) => ['saved', lang] as const,
  simulation: (ekatte: string, lang: string) => ['simulation', ekatte, lang] as const,
  plan: (ekatte: string, lang: string) => ['plan', ekatte, lang] as const,
}

export const profileQuery = queryOptions({
  queryKey: keys.profile,
  queryFn: async () => unwrap(await api.GET('/api/profile')),
})

export const settlementsQuery = (lang: string) =>
  queryOptions({
    queryKey: keys.settlements(lang),
    queryFn: async () => unwrap(await api.GET('/api/settlements')),
    staleTime: Infinity,
  })

export const settlementQuery = (ekatte: string, lang: string) =>
  queryOptions({
    queryKey: keys.settlement(ekatte, lang),
    queryFn: async () =>
      unwrap(await api.GET('/api/settlements/{ekatte}', { params: { path: { ekatte } } })),
    staleTime: Infinity,
  })

const useLang = () => useTranslation().i18n.language

export function useProfile() {
  return useQuery(profileQuery)
}

export function useSettlements() {
  return useQuery(settlementsQuery(useLang()))
}

export function useSettlement(ekatte: string) {
  return useQuery(settlementQuery(ekatte, useLang()))
}

export function useMatches(req: MatchRequest, enabled = true) {
  const lang = useLang()
  return useQuery({
    queryKey: keys.matches(req, lang),
    queryFn: async () => unwrap(await api.POST('/api/matches', { body: req })),
    enabled,
  })
}

export function useSaved() {
  const lang = useLang()
  return useQuery({
    queryKey: keys.saved(lang),
    queryFn: async () => unwrap(await api.GET('/api/saved')),
  })
}

export function useSimulation(ekatte: string) {
  const lang = useLang()
  return useQuery({
    queryKey: keys.simulation(ekatte, lang),
    queryFn: async () =>
      unwrap(
        await api.POST('/api/settlements/{ekatte}/simulation', { params: { path: { ekatte } } }),
      ),
    staleTime: Infinity,
  })
}

export function usePlan(ekatte: string) {
  const lang = useLang()
  return useQuery({
    queryKey: keys.plan(ekatte, lang),
    queryFn: async () =>
      unwrap(await api.POST('/api/settlements/{ekatte}/plan', { params: { path: { ekatte } } })),
  })
}

export function usePatchProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: ProfilePatch) =>
      unwrap(await api.PATCH('/api/profile', { body: patch })),
    onSuccess: (profile: Profile) => {
      qc.setQueryData(keys.profile, profile)
      // Answers changed: every score must be recomputed.
      void qc.invalidateQueries({ queryKey: ['matches'] })
      void qc.invalidateQueries({ queryKey: ['simulation'] })
      void qc.invalidateQueries({ queryKey: ['plan'] })
    },
  })
}

export function useRecordSwipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (swipe: Swipe) => {
      unwrap(await api.POST('/api/swipes', { body: swipe }))
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['saved'] })
    },
  })
}

/** "Delete my data": the session on the server, cached answers here and the journey in localStorage. */
export function useDeleteMyData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      unwrap(await api.DELETE('/api/session'))
    },
    onSuccess: () => {
      try {
        localStorage.removeItem('nakade.journey')
      } catch {
        // storage unavailable: nothing stored there either
      }
      qc.clear()
    },
  })
}

export async function ensureSession() {
  return unwrap(await api.POST('/api/session'))
}
