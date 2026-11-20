/**
 * Template "narration" for the mock simulation and plan. The real ones come from the backend
 * (rules + LLM with a grounding contract, see docs/proposals/ai.md). Fact statements only quote
 * values from the facts bundle; everything else is tagged `scenario`.
 */
import type { Fact, Profile, RelocationPlan, Scene, Simulation, Statement } from '../types'
import { factsFor, type Lang, type PlaceFixture } from './fixtures'

const fact = (text: string, f: Fact | undefined): Statement[] =>
  f && f.value !== null ? [{ kind: 'fact', text, fact_ids: [f.id] }] : []
const scenario = (text: string): Statement => ({ kind: 'scenario', text, fact_ids: [] })

export function buildSimulation(place: PlaceFixture, profile: Profile, lang: Lang): Simulation {
  const facts = factsFor(place)
  const f = (metric: string) => facts.find((x) => x.metric === metric)
  const name = lang === 'bg' ? place.summary.name_bg : place.summary.name_en
  const a = profile.answers
  const bg = lang === 'bg'
  const scenes: Scene[] = []

  scenes.push({
    id: 'morning',
    time: '07:30',
    title: bg ? 'Сутрин' : 'Morning',
    statements: [
      scenario(
        bg
          ? `Събуждате се в ${name}. Представете си тишината и чашата кафе на балкона.`
          : `You wake up in ${name}. Imagine the quiet and a coffee on the balcony.`,
      ),
      ...fact(
        bg
          ? `Около ${f('forest_share_pct')?.value}% от околността е гора.`
          : `About ${f('forest_share_pct')?.value}% of the surroundings is forest.`,
        f('forest_share_pct'),
      ),
    ],
  })

  if (a.household === 'family_kids') {
    const school = f('schools')?.value ? f('schools') : f('drive_min_to_school')
    scenes.push({
      id: 'school',
      time: '08:00',
      title: bg ? 'Към училище' : 'School run',
      statements: [
        ...(school?.metric === 'schools'
          ? fact(
              bg
                ? `В населеното място има ${school.value} училища.`
                : `There are ${school.value} schools in the place.`,
              school,
            )
          : fact(
              bg
                ? `Най-близкото училище е на ${school?.value} мин с кола.`
                : `The nearest school is a ${school?.value} min drive.`,
              school,
            )),
        scenario(
          bg
            ? 'Децата може би ще вървят пеша с приятели.'
            : 'The kids might walk there with friends.',
        ),
      ],
    })
  }

  const remote = a.work_mode === 'remote' || a.work_mode === 'self_employed'
  scenes.push({
    id: 'work',
    time: '09:00',
    title: bg ? 'Работа' : 'Work',
    statements: remote
      ? [
          ...fact(
            bg
              ? `Оценено покритие на бърз интернет: ${f('broadband_coverage_pct')?.value}%.`
              : `Estimated fast-internet coverage: ${f('broadband_coverage_pct')?.value}%.`,
            f('broadband_coverage_pct'),
          ),
          scenario(
            bg
              ? 'Работите от вкъщи с изглед към хълмовете.'
              : 'You work from home with a view of the hills.',
          ),
        ]
      : [
          ...fact(
            bg
              ? `До София се пътува около ${f('drive_min_to_sofia')?.value} мин с кола.`
              : `Sofia is about a ${f('drive_min_to_sofia')?.value} min drive.`,
            f('drive_min_to_sofia'),
          ),
          scenario(
            bg ? 'Може би ще намерите работа на място.' : 'You might find work locally instead.',
          ),
        ],
  })

  scenes.push({
    id: 'errands',
    time: '13:00',
    title: bg ? 'Пазаруване и услуги' : 'Errands',
    statements: [
      ...fact(
        bg
          ? `Супермаркети в мястото: ${f('supermarkets')?.value}.`
          : `Supermarkets in the place: ${f('supermarkets')?.value}.`,
        f('supermarkets'),
      ),
      ...fact(
        bg
          ? `Най-близката болница е на ${f('drive_min_to_hospital')?.value} мин с кола.`
          : `The nearest hospital is a ${f('drive_min_to_hospital')?.value} min drive.`,
        f('drive_min_to_hospital'),
      ),
      ...(a.has_car === false
        ? [
            scenario(
              bg
                ? 'Без кола ще разчитате на автобуси и съседи.'
                : 'Without a car you would rely on buses and neighbours.',
            ),
          ]
        : []),
    ],
  })

  scenes.push({
    id: 'evening',
    time: '18:30',
    title: bg ? 'Вечер' : 'Evening',
    statements: [
      scenario(
        bg
          ? 'Разходка до близката пътека и вечеря с нови съседи.'
          : 'A walk to the nearby trail and dinner with new neighbours.',
      ),
    ],
  })

  const usedIds = new Set(scenes.flatMap((s) => s.statements.flatMap((st) => st.fact_ids)))
  return { ekatte: place.summary.ekatte, scenes, facts: facts.filter((x) => usedIds.has(x.id)) }
}

export function buildPlan(place: PlaceFixture, profile: Profile, lang: Lang): RelocationPlan {
  const bg = lang === 'bg'
  const e = place.summary.ekatte
  const a = profile.answers
  const sections: RelocationPlan['sections'] = [
    {
      key: 'housing',
      items: [
        {
          id: 'h1',
          text: bg ? 'Огледайте 3–5 жилища на място' : 'Visit 3–5 homes in person',
          fact_ids: [],
        },
        {
          id: 'h2',
          text: bg
            ? 'Проверете отопление и интернет на адреса'
            : 'Check heating and internet at the address',
          fact_ids: [`fact_${e}_broadband_coverage_pct`],
        },
      ],
    },
    {
      key: 'admin',
      items: [
        {
          id: 'a1',
          text: bg ? 'Сменете постоянния/настоящия адрес' : 'Register your new address',
          fact_ids: [],
        },
        {
          id: 'a2',
          text: bg ? 'Изберете нов личен лекар' : 'Register with a new GP',
          fact_ids: [`fact_${e}_gp_count`],
        },
      ],
    },
  ]
  if (a.household === 'family_kids') {
    sections.push({
      key: 'education',
      items: [
        {
          id: 'e1',
          text: bg
            ? 'Подайте документи за училище/детска градина'
            : 'Apply for school / kindergarten',
          fact_ids: [],
        },
      ],
    })
  }
  if (a.work_mode === 'looking' || a.work_mode === 'office') {
    sections.push({
      key: 'employment',
      items: [
        {
          id: 'j1',
          text: bg ? 'Разгледайте местни обяви за работа' : 'Look at local job ads',
          fact_ids: [],
        },
      ],
    })
  }
  return { ekatte: place.summary.ekatte, sections }
}
