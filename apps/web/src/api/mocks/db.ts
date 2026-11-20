/**
 * Tiny in-browser "database" for the mock API. It plays the role of server-side persistence:
 * profile, swipes and saved places survive a reload (localStorage), like the real API will by
 * session cookie. Reset with `resetMockDb()` or by clearing site data.
 */
import type { Profile, ProfilePatch, Session, SwipeAction } from '../types'

const KEY = 'nakade.mock-db.v1'

export interface MockDb {
  session: Session | null
  profile: Profile
  swipes: { ekatte: string; action: SwipeAction; created_at: string }[]
}

const ORDER = { none: 0, quick: 1, detailed: 2 } as const

function empty(): MockDb {
  return {
    session: null,
    profile: { completeness: 'none', answers: {}, updated_at: new Date(0).toISOString() },
    swipes: [],
  }
}

let memory: MockDb | null = null

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readDb(): MockDb {
  if (memory) return memory
  try {
    const raw = storage()?.getItem(KEY)
    memory = raw ? { ...empty(), ...(JSON.parse(raw) as MockDb) } : empty()
  } catch {
    memory = empty()
  }
  return memory
}

export function writeDb(db: MockDb) {
  memory = db
  try {
    storage()?.setItem(KEY, JSON.stringify(db))
  } catch {
    // storage unavailable (private mode): keep in memory only
  }
}

export function resetMockDb() {
  memory = empty()
  try {
    storage()?.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Progressive profiling: merge answers, completeness only moves forward. */
export function mergeProfile(profile: Profile, patch: ProfilePatch): Profile {
  const completeness =
    patch.completeness && ORDER[patch.completeness] > ORDER[profile.completeness]
      ? patch.completeness
      : profile.completeness
  return {
    completeness,
    answers: { ...profile.answers, ...patch.answers },
    updated_at: new Date().toISOString(),
  }
}
