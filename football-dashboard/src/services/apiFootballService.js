/**
 * apiFootballService.js
 * Cliente para API-Football v3 — https://www.api-football.com
 *
 * Plan Free: 100 requests/día
 * Se usa para enriquecer partidos con:
 *   - H2H (últimos 5 enfrentamientos directos)
 *   - Racha local/visitante por separado
 *   - Posición en tabla + puntos
 *   - Ventaja de local histórica por estadio
 */

const BASE = 'https://v3.football.api-sports.io'

// Mapa de sport_key de Odds API → league ID de API-Football
const ODDS_TO_APIFB = {
  soccer_epl:                        39,   // Premier League
  soccer_spain_la_liga:              140,  // La Liga
  soccer_germany_bundesliga:         78,   // Bundesliga
  soccer_italy_serie_a:              135,  // Serie A
  soccer_france_ligue_one:           61,   // Ligue 1
  soccer_brazil_campeonato:          71,   // Brasileirão Série A
  soccer_argentina_primera_division: 128,  // Liga Profesional Argentina
  soccer_mexico_ligamx:              262,  // Liga MX
  soccer_netherlands_eredivisie:     88,   // Eredivisie
  soccer_portugal_primeira_liga:     94,   // Primeira Liga
  soccer_turkey_super_league:        203,  // Süper Lig
  soccer_usa_mls:                    253,  // MLS
}

const HEADERS = (key) => ({
  'x-apisports-key': key,
  'Accept': 'application/json',
})

const TIMEOUT_MS = 8000

// ─── helpers ──────────────────────────────────────────────────────────────────

async function safeFetch(url, key) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: HEADERS(key), signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP_${res.status}`)
    return await res.json()
  } catch (err) {
    clearTimeout(timer)
    throw err.name === 'AbortError' ? new Error('APIFB_TIMEOUT') : err
  }
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|as|rb|sv|bv|fk|sk)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── búsqueda de fixture ──────────────────────────────────────────────────────

/**
 * Busca un fixture por nombre de equipos en una fecha específica.
 * Devuelve el fixture con el ID necesario para consultas H2H y estadísticas.
 */
async function findFixture(apiKey, leagueId, season, homeName, awayName, date) {
  try {
    const data = await safeFetch(
      `${BASE}/fixtures?league=${leagueId}&season=${season}&date=${date}`,
      apiKey
    )

    const fixtures = data?.response ?? []
    const homeN = normalizeName(homeName)
    const awayN = normalizeName(awayName)

    for (const f of fixtures) {
      const fHomeN = normalizeName(f.teams?.home?.name ?? '')
      const fAwayN = normalizeName(f.teams?.away?.name ?? '')
      if (fHomeN.includes(homeN) && fAwayN.includes(awayN)) {
        return {
          fixtureId: f.fixture?.id,
          homeId:    f.teams?.home?.id,
          awayId:    f.teams?.away?.id,
          venue:     f.fixture?.venue?.name,
          leagueId:  f.league?.id,
          season:    f.league?.season,
        }
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── H2H ──────────────────────────────────────────────────────────────────────

/**
 * Obtiene los últimos 5 enfrentamientos directos entre dos equipos.
 */
async function fetchH2H(apiKey, homeId, awayId) {
  try {
    const data = await safeFetch(
      `${BASE}/fixtures/headtohead?h2h=${homeId}-${awayId}&last=5`,
      apiKey
    )
    const fixtures = data?.response ?? []
    return fixtures.map(f => ({
      date:        f.fixture?.date?.split('T')[0],
      homeTeam:    f.teams?.home?.name,
      awayTeam:    f.teams?.away?.name,
      homeScore:   f.goals?.home,
      awayScore:   f.goals?.away,
      winner:      f.teams?.home?.winner === true ? 'home' :
                   f.teams?.away?.winner === true ? 'away' : 'draw',
    }))
  } catch {
    return []
  }
}

// ─── Racha local/visitante ────────────────────────────────────────────────────

/**
 * Obtiene la racha de un equipo filtrando por local o visitante.
 */
async function fetchFormSplit(apiKey, teamId, season, venue) {
  try {
    const data = await safeFetch(
      `${BASE}/fixtures?team=${teamId}&season=${season}&last=10&venue=${venue}`,
      apiKey
    )
    const fixtures = data?.response ?? []
    const form = fixtures.slice(0, 5).map(f => {
      const isHome = f.teams?.home?.id === teamId
      const won    = f.teams?.[isHome ? 'home' : 'away']?.winner === true
      const lost   = f.teams?.[isHome ? 'away' : 'home']?.winner === true
      return won ? 'W' : lost ? 'L' : 'D'
    })
    return form.join('')
  } catch {
    return null
  }
}

// ─── Posición en tabla ────────────────────────────────────────────────────────

/**
 * Obtiene la posición en tabla de un equipo (rank, puntos, partidos).
 */
async function fetchStanding(apiKey, leagueId, season, teamId) {
  try {
    const data = await safeFetch(
      `${BASE}/standings?league=${leagueId}&season=${season}`,
      apiKey
    )
    const standings = data?.response?.[0]?.league?.standings?.[0] ?? []
    const entry = standings.find(s => s.team?.id === teamId)
    if (!entry) return null
    return {
      rank:   entry.rank,
      points: entry.points,
      played: entry.all?.played,
      form:   entry.form,   // últimos 5 (todos los partidos, no split)
    }
  } catch {
    return null
  }
}

// ─── Ventaja de local ─────────────────────────────────────────────────────────

/**
 * Calcula el % de victorias en casa del equipo local en la temporada actual.
 */
async function fetchHomeAdvantage(apiKey, teamId, season) {
  try {
    const data = await safeFetch(
      `${BASE}/fixtures?team=${teamId}&season=${season}&venue=home&status=FT`,
      apiKey
    )
    const fixtures = data?.response ?? []
    if (!fixtures.length) return null

    const won = fixtures.filter(f => f.teams?.home?.winner === true).length
    return parseFloat(((won / fixtures.length) * 100).toFixed(1))
  } catch {
    return null
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Enriquece un array de matches con datos avanzados de API-Football.
 *
 * Estrategia para no gastar cuota:
 *   1. Solo procesa matches de ligas cubiertas en ODDS_TO_APIFB
 *   2. Hace requests en batch por liga (standings 1x por liga, no 1x por partido)
 *   3. Cachea standings en memoria durante la ejecución
 *
 * Requests estimados por ejecución (20 partidos):
 *   - fixtures search: ~3-5 ligas = 3-5 req
 *   - standings:       ~3-5 ligas = 3-5 req (1x por liga)
 *   - h2h:             ~10-15 partidos encontrados = 10-15 req
 *   - form split:      ~10-15 partidos × 2 equipos × 2 venues = ALTO (40-60 req)
 *   - home advantage:  ~10-15 locales = 10-15 req
 *   TOTAL: ~70-100 req → excede el límite free (100/día) con análisis frecuentes
 *
 * Por eso solo activo H2H + standings + home advantage (30-35 req/análisis).
 * Form split se omite porque ESPN ya lo tiene.
 *
 * @param {EnrichedMatch[]} matches
 * @param {string}          apiKey
 * @returns {Promise<EnrichedMatch[]>}
 */
export async function enrichWithAPIFootball(matches, apiKey) {
  if (!apiKey?.trim()) {
    console.warn('[API-Football] No API key, skipping enrichment')
    return matches
  }

  const standingsCache = new Map()  // key: `${leagueId}_${season}`, value: standings array

  const enriched = []
  for (const match of matches) {
    const leagueId = ODDS_TO_APIFB[match.sportKey]
    if (!leagueId) {
      enriched.push(match)
      continue
    }

    const season = parseInt(match.date?.split('-')[0] ?? new Date().getFullYear())

    // Buscar fixture
    const fixture = await findFixture(
      apiKey, leagueId, season,
      match.home, match.away, match.date
    )

    if (!fixture) {
      enriched.push(match)
      continue
    }

    // Fetch en paralelo: H2H, standings (con cache), home advantage
    const [h2h, homeStanding, awayStanding, homeAdvantage] = await Promise.all([
      fetchH2H(apiKey, fixture.homeId, fixture.awayId),

      (async () => {
        const cacheKey = `${fixture.leagueId}_${fixture.season}`
        if (!standingsCache.has(cacheKey)) {
          const data = await safeFetch(
            `${BASE}/standings?league=${fixture.leagueId}&season=${fixture.season}`,
            apiKey
          ).catch(() => ({ response: [] }))
          standingsCache.set(cacheKey, data?.response?.[0]?.league?.standings?.[0] ?? [])
        }
        const standings = standingsCache.get(cacheKey)
        return standings.find(s => s.team?.id === fixture.homeId) ?? null
      })(),

      (async () => {
        const cacheKey = `${fixture.leagueId}_${fixture.season}`
        const standings = standingsCache.get(cacheKey) ?? []
        return standings.find(s => s.team?.id === fixture.awayId) ?? null
      })(),

      fetchHomeAdvantage(apiKey, fixture.homeId, fixture.season),
    ])

    enriched.push({
      ...match,
      apiFb: {
        h2h,
        homeStanding: homeStanding ? {
          rank:   homeStanding.rank,
          points: homeStanding.points,
          played: homeStanding.all?.played,
        } : null,
        awayStanding: awayStanding ? {
          rank:   awayStanding.rank,
          points: awayStanding.points,
          played: awayStanding.all?.played,
        } : null,
        homeAdvantage,   // % victorias en casa
      },
    })
  }

  const withData = enriched.filter(m => m.apiFb).length
  console.info(`[API-Football] ${withData}/${matches.length} partidos enriquecidos`)

  return enriched
}
