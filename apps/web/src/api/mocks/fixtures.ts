/**
 * DEMO FIXTURES: NOT REAL DATA.
 *
 * Every value below is a hand-written placeholder so the UI can be built before the data
 * pipeline exists. Place names are real, but the numbers are NOT and must not be read as facts
 * about these places. All facts point to the `demo` source, and the UI marks them with a
 * "Demo data" badge. EKATTE codes are also unverified and must be checked against the NSI
 * classifier before anything relies on them.
 *
 * Statuses (verified / derived / estimated) are spread across the fixtures only to exercise
 * the <Fact> states. They describe what the real pipeline would label, not the truth of these
 * placeholder values.
 */
import type { Dimension, Fact, FactStatus, Settlement, SettlementSummary, Source } from '../types'

export const DEMO_SOURCE: Source = {
  id: 'demo',
  name: 'Demo placeholder (not real data)',
  url: null,
  licence: null,
}

const RETRIEVED_AT = '2026-11-20'

type FactRow = [
  dimension: Dimension,
  metric: string,
  value: number | string | null,
  unit: string | null,
  status: FactStatus,
  method?: string,
]

type Hook = { bg: string; en: string }

export interface PlaceFixture {
  summary: Omit<SettlementSummary, 'hook'>
  hook: Hook
  facts: FactRow[]
  /** Placeholder per-dimension scores (0..1, null = not enough data) used by the mock matcher */
  scores: Record<Dimension, number | null>
  nearby: { ekatte: string; drive_min: number }[]
}

const routing = 'Demo: placeholder for car routing to the nearest service'
const share = 'Demo: placeholder for an area-share calculation'
const guess = 'Demo: placeholder estimate'

export const PLACES: PlaceFixture[] = [
  {
    summary: {
      ekatte: '73198',
      name_bg: 'Трявна',
      name_en: 'Tryavna',
      type: 'town',
      municipality: 'Трявна',
      district: 'Габрово',
      lat: 42.866,
      lon: 25.493,
      parent_town_ekatte: null,
      population: 9000,
      image_url: null,
    },
    hook: {
      bg: 'Тих планински град с калдъръмени улици и гора на прага.',
      en: 'A quiet mountain town with cobbled streets and forest on the doorstep.',
    },
    facts: [
      ['transport', 'drive_min_to_sofia', 190, 'min', 'derived', routing],
      ['transport', 'train_station', 'yes', null, 'verified'],
      ['healthcare', 'drive_min_to_hospital', 25, 'min', 'derived', routing],
      ['healthcare', 'gp_count', 6, 'count', 'verified'],
      ['education', 'schools', 3, 'count', 'verified'],
      ['education', 'kindergarten_capacity', null, 'places', 'verified'],
      ['amenities', 'supermarkets', 5, 'count', 'verified'],
      ['amenities', 'broadband_coverage_pct', 80, '%', 'estimated', guess],
      ['nature', 'forest_share_pct', 70, '%', 'derived', share],
      ['employment', 'unemployment_rate_pct', 5, '%', 'verified'],
      ['employment', 'job_ads_per_1000', null, 'per 1000', 'estimated'],
      ['demographics', 'median_age', 50, 'years', 'verified'],
    ],
    scores: {
      transport: 0.45,
      healthcare: 0.6,
      education: 0.55,
      amenities: 0.6,
      nature: 0.92,
      employment: 0.4,
      demographics: 0.35,
    },
    nearby: [
      { ekatte: '05596', drive_min: 15 },
      { ekatte: '14218', drive_min: 25 },
    ],
  },
  {
    summary: {
      ekatte: '14218',
      name_bg: 'Габрово',
      name_en: 'Gabrovo',
      type: 'town',
      municipality: 'Габрово',
      district: 'Габрово',
      lat: 42.874,
      lon: 25.334,
      parent_town_ekatte: null,
      population: 50000,
      image_url: null,
    },
    hook: {
      bg: 'Индустриален град с чувство за хумор, в подножието на Балкана.',
      en: 'An industrial town with a sense of humour at the foot of the Balkans.',
    },
    facts: [
      ['transport', 'drive_min_to_sofia', 170, 'min', 'derived', routing],
      ['transport', 'train_station', 'yes', null, 'verified'],
      ['healthcare', 'drive_min_to_hospital', 8, 'min', 'derived', routing],
      ['healthcare', 'gp_count', 40, 'count', 'verified'],
      ['education', 'schools', 15, 'count', 'verified'],
      ['education', 'kindergarten_capacity', 2000, 'places', 'verified'],
      ['amenities', 'supermarkets', 30, 'count', 'verified'],
      ['amenities', 'broadband_coverage_pct', 92, '%', 'estimated', guess],
      ['nature', 'forest_share_pct', 55, '%', 'derived', share],
      ['employment', 'unemployment_rate_pct', 4, '%', 'verified'],
      ['employment', 'job_ads_per_1000', 12, 'per 1000', 'estimated', guess],
      ['demographics', 'median_age', 47, 'years', 'verified'],
    ],
    scores: {
      transport: 0.55,
      healthcare: 0.85,
      education: 0.8,
      amenities: 0.8,
      nature: 0.7,
      employment: 0.7,
      demographics: 0.45,
    },
    nearby: [
      { ekatte: '73198', drive_min: 25 },
      { ekatte: '05596', drive_min: 20 },
    ],
  },
  {
    summary: {
      ekatte: '10447',
      name_bg: 'Велико Търново',
      name_en: 'Veliko Tarnovo',
      type: 'town',
      municipality: 'Велико Търново',
      district: 'Велико Търново',
      lat: 43.081,
      lon: 25.629,
      parent_town_ekatte: null,
      population: 65000,
      image_url: null,
    },
    hook: {
      bg: 'Университетски град над завоите на Янтра.',
      en: 'A university town above the bends of the Yantra river.',
    },
    facts: [
      ['transport', 'drive_min_to_sofia', 165, 'min', 'derived', routing],
      ['transport', 'train_station', 'yes', null, 'verified'],
      ['healthcare', 'drive_min_to_hospital', 7, 'min', 'derived', routing],
      ['healthcare', 'gp_count', 60, 'count', 'verified'],
      ['education', 'schools', 20, 'count', 'verified'],
      ['education', 'kindergarten_capacity', 2500, 'places', 'verified'],
      ['amenities', 'supermarkets', 40, 'count', 'verified'],
      ['amenities', 'broadband_coverage_pct', 95, '%', 'estimated', guess],
      ['nature', 'forest_share_pct', 35, '%', 'derived', share],
      ['employment', 'unemployment_rate_pct', 4, '%', 'verified'],
      ['employment', 'job_ads_per_1000', 15, 'per 1000', 'estimated', guess],
      ['demographics', 'median_age', 43, 'years', 'verified'],
    ],
    scores: {
      transport: 0.6,
      healthcare: 0.85,
      education: 0.9,
      amenities: 0.85,
      nature: 0.55,
      employment: 0.75,
      demographics: 0.65,
    },
    nearby: [{ ekatte: '00487', drive_min: 10 }],
  },
  {
    summary: {
      ekatte: '56784',
      name_bg: 'Пловдив',
      name_en: 'Plovdiv',
      type: 'town',
      municipality: 'Пловдив',
      district: 'Пловдив',
      lat: 42.144,
      lon: 24.75,
      parent_town_ekatte: null,
      population: 340000,
      image_url: null,
    },
    hook: {
      bg: 'Голям град с древен център, творческа сцена и Родопите наблизо.',
      en: 'A big city with an ancient centre, a creative scene and the Rhodopes nearby.',
    },
    facts: [
      ['transport', 'drive_min_to_sofia', 100, 'min', 'derived', routing],
      ['transport', 'train_station', 'yes', null, 'verified'],
      ['healthcare', 'drive_min_to_hospital', 10, 'min', 'derived', routing],
      ['healthcare', 'gp_count', 300, 'count', 'verified'],
      ['education', 'schools', 80, 'count', 'verified'],
      ['education', 'kindergarten_capacity', null, 'places', 'verified'],
      ['amenities', 'supermarkets', 200, 'count', 'verified'],
      ['amenities', 'broadband_coverage_pct', 98, '%', 'estimated', guess],
      ['nature', 'forest_share_pct', 10, '%', 'derived', share],
      ['employment', 'unemployment_rate_pct', 3, '%', 'verified'],
      ['employment', 'job_ads_per_1000', 25, 'per 1000', 'estimated', guess],
      ['demographics', 'median_age', 42, 'years', 'verified'],
    ],
    scores: {
      transport: 0.85,
      healthcare: 0.9,
      education: 0.85,
      amenities: 0.95,
      nature: 0.3,
      employment: 0.9,
      demographics: 0.75,
    },
    nearby: [],
  },
  {
    summary: {
      ekatte: '67653',
      name_bg: 'Смолян',
      name_en: 'Smolyan',
      type: 'town',
      municipality: 'Смолян',
      district: 'Смолян',
      lat: 41.577,
      lon: 24.701,
      parent_town_ekatte: null,
      population: 27000,
      image_url: null,
    },
    hook: {
      bg: 'Дълъг планински град в сърцето на Родопите.',
      en: 'A long mountain town in the heart of the Rhodopes.',
    },
    facts: [
      ['transport', 'drive_min_to_sofia', 210, 'min', 'derived', routing],
      ['transport', 'train_station', 'no', null, 'verified'],
      ['healthcare', 'drive_min_to_hospital', 10, 'min', 'derived', routing],
      ['healthcare', 'gp_count', 25, 'count', 'verified'],
      ['education', 'schools', 10, 'count', 'verified'],
      ['education', 'kindergarten_capacity', 900, 'places', 'verified'],
      ['amenities', 'supermarkets', 15, 'count', 'verified'],
      ['amenities', 'broadband_coverage_pct', null, '%', 'estimated'],
      ['nature', 'forest_share_pct', 75, '%', 'derived', share],
      ['employment', 'unemployment_rate_pct', 7, '%', 'verified'],
      ['employment', 'job_ads_per_1000', 6, 'per 1000', 'estimated', guess],
      ['demographics', 'median_age', 48, 'years', 'verified'],
    ],
    scores: {
      transport: 0.25,
      healthcare: 0.75,
      education: 0.65,
      amenities: 0.6,
      nature: 0.95,
      employment: 0.4,
      demographics: 0.4,
    },
    nearby: [],
  },
  {
    summary: {
      ekatte: '05596',
      name_bg: 'Боженци',
      name_en: 'Bozhentsi',
      type: 'village',
      municipality: 'Габрово',
      district: 'Габрово',
      lat: 42.876,
      lon: 25.433,
      parent_town_ekatte: '14218',
      population: 50,
      image_url: null,
    },
    hook: {
      bg: 'Архитектурно село-резерват с каменни покриви, на 20 минути от Габрово.',
      en: 'A preserved village of stone roofs, about 20 minutes from Gabrovo.',
    },
    facts: [
      ['transport', 'drive_min_to_sofia', 195, 'min', 'derived', routing],
      ['transport', 'train_station', 'no', null, 'verified'],
      [
        'healthcare',
        'drive_min_to_hospital',
        20,
        'min',
        'derived',
        `${routing} (in a nearby town)`,
      ],
      ['healthcare', 'gp_count', 0, 'count', 'verified'],
      ['education', 'schools', 0, 'count', 'verified'],
      ['education', 'drive_min_to_school', 18, 'min', 'derived', routing],
      ['amenities', 'supermarkets', 0, 'count', 'verified'],
      ['amenities', 'broadband_coverage_pct', null, '%', 'estimated'],
      ['nature', 'forest_share_pct', 85, '%', 'derived', share],
      ['employment', 'unemployment_rate_pct', null, '%', 'verified'],
      ['demographics', 'median_age', null, 'years', 'verified'],
    ],
    scores: {
      transport: 0.2,
      healthcare: 0.55,
      education: 0.4,
      amenities: 0.15,
      nature: 0.98,
      employment: null,
      demographics: null,
    },
    nearby: [
      { ekatte: '14218', drive_min: 20 },
      { ekatte: '73198', drive_min: 15 },
    ],
  },
  {
    summary: {
      ekatte: '00487',
      name_bg: 'Арбанаси',
      name_en: 'Arbanasi',
      type: 'village',
      municipality: 'Велико Търново',
      district: 'Велико Търново',
      lat: 43.1,
      lon: 25.666,
      parent_town_ekatte: '10447',
      population: 1500,
      image_url: null,
    },
    hook: {
      bg: 'Село на плато над Велико Търново: тишина, но градът е на 10 минути.',
      en: 'A village on a plateau above Veliko Tarnovo: quiet, yet the city is 10 minutes away.',
    },
    facts: [
      ['transport', 'drive_min_to_sofia', 175, 'min', 'derived', routing],
      ['transport', 'train_station', 'no', null, 'verified'],
      [
        'healthcare',
        'drive_min_to_hospital',
        12,
        'min',
        'derived',
        `${routing} (in a nearby town)`,
      ],
      ['healthcare', 'gp_count', 1, 'count', 'verified'],
      ['education', 'schools', 1, 'count', 'verified'],
      ['education', 'kindergarten_capacity', null, 'places', 'verified'],
      ['amenities', 'supermarkets', 1, 'count', 'verified'],
      ['amenities', 'broadband_coverage_pct', 70, '%', 'estimated', guess],
      ['nature', 'forest_share_pct', 30, '%', 'derived', share],
      ['employment', 'unemployment_rate_pct', null, '%', 'verified'],
      ['demographics', 'median_age', 45, 'years', 'verified'],
    ],
    scores: {
      transport: 0.45,
      healthcare: 0.7,
      education: 0.5,
      amenities: 0.35,
      nature: 0.75,
      employment: null,
      demographics: 0.5,
    },
    nearby: [{ ekatte: '10447', drive_min: 10 }],
  },
]

export const DIMENSIONS: Dimension[] = [
  'transport',
  'healthcare',
  'education',
  'amenities',
  'nature',
  'employment',
  'demographics',
]

export function factId(ekatte: string, metric: string) {
  return `fact_${ekatte}_${metric}`
}

export function factsFor(place: PlaceFixture): Fact[] {
  return place.facts.map(([dimension, metric, value, unit, status, method]) => ({
    id: factId(place.summary.ekatte, metric),
    ekatte: place.summary.ekatte,
    dimension,
    metric,
    value,
    unit,
    status,
    method: method ?? null,
    source: DEMO_SOURCE,
    retrieved_at: RETRIEVED_AT,
  }))
}

export type Lang = 'bg' | 'en'

export function findPlace(ekatte: string) {
  return PLACES.find((p) => p.summary.ekatte === ekatte)
}

export function toSummary(place: PlaceFixture, lang: Lang): SettlementSummary {
  return { ...place.summary, hook: place.hook[lang] }
}

export function toSettlement(place: PlaceFixture, lang: Lang): Settlement {
  return {
    ...toSummary(place, lang),
    facts: factsFor(place),
    nearby: place.nearby.flatMap(({ ekatte, drive_min }) => {
      const other = findPlace(ekatte)
      return other ? [{ settlement: toSummary(other, lang), drive_min }] : []
    }),
  }
}
