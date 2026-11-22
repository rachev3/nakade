import { delay, http, HttpResponse } from 'msw'
import type { MatchRequest, ProfilePatch, SavedPlace, Swipe } from '../types'
import { mergeProfile, readDb, resetMockDb, writeDb } from './db'
import { findPlace, type Lang, PLACES, toSettlement, toSummary } from './fixtures'
import { matchPlace, rank } from './matcher'
import { buildPlan, buildSimulation } from './narratives'

const lang = (request: Request): Lang =>
  request.headers.get('accept-language')?.toLowerCase().startsWith('en') ? 'en' : 'bg'

/** Small artificial latency so loading states are visible. */
const latency = () => delay(150)

const notFound = (ekatte: string) =>
  HttpResponse.json({ code: 'not_found', message: `Unknown EKATTE ${ekatte}` }, { status: 404 })

export const handlers = [
  http.post('*/api/session', async () => {
    const db = readDb()
    if (!db.session) {
      db.session = { session_id: crypto.randomUUID(), created_at: new Date().toISOString() }
      writeDb(db)
    }
    return HttpResponse.json(db.session)
  }),

  http.delete('*/api/session', () => {
    resetMockDb()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('*/api/profile', async () => {
    await latency()
    return HttpResponse.json(readDb().profile)
  }),

  http.patch('*/api/profile', async ({ request }) => {
    const patch = (await request.json()) as ProfilePatch
    const db = readDb()
    db.profile = mergeProfile(db.profile, patch)
    writeDb(db)
    return HttpResponse.json(db.profile)
  }),

  http.get('*/api/settlements', async ({ request }) => {
    await latency()
    const type = new URL(request.url).searchParams.get('type')
    return HttpResponse.json(
      PLACES.filter((p) => !type || p.summary.type === type).map((p) =>
        toSummary(p, lang(request)),
      ),
    )
  }),

  http.get('*/api/settlements/:ekatte', async ({ params, request }) => {
    await latency()
    const place = findPlace(String(params.ekatte))
    if (!place) return notFound(String(params.ekatte))
    return HttpResponse.json(toSettlement(place, lang(request)))
  }),

  http.post('*/api/matches', async ({ request }) => {
    await latency()
    const text = await request.text()
    const body = (text ? JSON.parse(text) : {}) as MatchRequest
    const db = readDb()
    const swiped = new Set(db.swipes.map((s) => s.ekatte))
    const places = PLACES.filter(
      (p) =>
        (!body.ekatte || body.ekatte.includes(p.summary.ekatte)) &&
        (!body.type || p.summary.type === body.type) &&
        (!body.exclude_swiped || !swiped.has(p.summary.ekatte)),
    )
    const matches = rank(places.map((p) => matchPlace(p, db.profile, lang(request))))
    return HttpResponse.json(matches.slice(0, body.limit ?? 20))
  }),

  http.post('*/api/swipes', async ({ request }) => {
    const swipe = (await request.json()) as Swipe
    const db = readDb()
    db.swipes = db.swipes.filter((s) => s.ekatte !== swipe.ekatte)
    db.swipes.push({ ...swipe, created_at: new Date().toISOString() })
    writeDb(db)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('*/api/saved', async ({ request }) => {
    await latency()
    const saved: SavedPlace[] = readDb().swipes.flatMap((s) => {
      const place = findPlace(s.ekatte)
      if (!place || s.action === 'dislike') return []
      return [
        { settlement: toSummary(place, lang(request)), action: s.action, created_at: s.created_at },
      ]
    })
    return HttpResponse.json(saved.reverse())
  }),

  http.post('*/api/settlements/:ekatte/simulation', async ({ params, request }) => {
    await delay(400)
    const place = findPlace(String(params.ekatte))
    if (!place) return notFound(String(params.ekatte))
    return HttpResponse.json(buildSimulation(place, readDb().profile, lang(request)))
  }),

  http.post('*/api/settlements/:ekatte/plan', async ({ params, request }) => {
    await latency()
    const place = findPlace(String(params.ekatte))
    if (!place) return notFound(String(params.ekatte))
    return HttpResponse.json(buildPlan(place, readDb().profile, lang(request)))
  }),
]
