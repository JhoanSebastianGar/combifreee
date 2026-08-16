/**
 * espnService.js
 * API pública de ESPN para forma reciente de equipos de fútbol.
 *
 * Gratuita, sin autenticación, sin rate-limit conocido.
 * Endpoints usados:
 *   /scoreboard  → lista de partidos + campo `form` por equipo (WLWWW) + resultados finales
 *   /summary     → lastFiveGames con detalle de cada partido
 *
 * Se usa para:
 *   1. Enriquecer matches de The Odds API con forma real
 *   2. Obtener resultados finales de partidos para actualización automática
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'

const TIMEOUT_MS = 7000

// ─── Mapa de ligas: sport_key de Odds API → slug de ESPN ─────────────────────
// Cubre las principales ligas que devuelve The Odds API
const ODDS_TO_ESPN = {
  soccer_epl:                        'eng.1',
  soccer_spain_la_liga:              'esp.1',
  soccer_germany_bundesliga:         'ger.1',
  soccer_italy_serie_a:              'ita.1',
  soccer_france_ligue_one:           'fra.1',
  soccer_netherlands_eredivisie:     'ned.1',
  soccer_portugal_primeira_liga:     'por.1',
  soccer_turkey_super_league:        'tur.1',
  soccer_brazil_campeonato:          'bra.1',
  soccer_argentina_primera_division: 'arg.1',
  soccer_mexico_ligamx:              'mex.1',
  soccer_uefa_champs_league:         'uefa.champions',
  soccer_uefa_europa_league:         'uefa.europa',
  soccer_usa_mls:                    'usa.1',
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function safeFetch(url) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP_${res.status}`)
    return await res.json()
  } catch (err) {
    clearTimeout(timer)
    throw err.name === 'AbortError' ? new Error('ESPN_TIMEOUT') : err
  }
}

/**
 * Normaliza una cadena de forma a exactamente 5 caracteres uppercase.
 * ESPN devuelve 'WLWWW' pero a veces con minúsculas o más de 5.
 */
function normalizeForm(raw) {
  if (!raw || typeof raw !== 'string') return null
  return raw.toUpperCase().slice(-5)   // últimos 5 siempre
}

// ─── Capa 1: Scoreboard (forma rápida) ───────────────────────────────────────

/**
 * Obtiene todos los eventos de una liga con su forma incluida.
 * @param {string} espnSlug  ej: 'eng.1'
 * @returns {Promise<Map<string, {homeForm, awayForm}>>}
 *   Map keyed by "{homeTeamName}|{awayTeamName}" (normalizado lowercase)
 */
async function fetchFormFromScoreboard(espnSlug) {
  const data   = await safeFetch(`${ESPN_BASE}/${espnSlug}/scoreboard`)
  const events = data?.events ?? []

  const formMap = new Map()

  for (const event of events) {
    const comp        = event.competitions?.[0]
    const competitors = comp?.competitors ?? []

    const home = competitors.find(c => c.homeAway === 'home')
    const away = competitors.find(c => c.homeAway === 'away')

    if (!home || !away) continue

    const homeForm = normalizeForm(home.form)
    const awayForm = normalizeForm(away.form)
    const homeName = home.team?.displayName ?? ''
    const awayName = away.team?.displayName ?? ''

    // Guardar por nombre normalizado para matching fuzzy después
    formMap.set(`${homeName.toLowerCase()}|${awayName.toLowerCase()}`, {
      espnEventId: event.id,
      homeForm,
      awayForm,
      homeName,
      awayName,
      homeEspnId: home.team?.id,
      awayEspnId: away.team?.id,
    })
  }

  return formMap
}

// ─── Capa 2: Summary (lastFiveGames detallado) ───────────────────────────────

/**
 * Obtiene los últimos 5 partidos detallados de ambos equipos.
 * Solo se llama si tenemos el espnEventId del partido.
 * @param {string} espnSlug
 * @param {string} eventId
 * @returns {Promise<{home: LastFiveEntry[], away: LastFiveEntry[]}|null>}
 */
async function fetchLastFiveGames(espnSlug, eventId) {
  try {
    const data = await safeFetch(
      `${ESPN_BASE}/${espnSlug}/summary?event=${eventId}`
    )
    const lastFive = data?.lastFiveGames ?? []

    const parseTeam = (entry) => {
      if (!entry) return null
      return {
        teamName: entry.team?.displayName,
        teamLogo: entry.team?.logo,
        games: (entry.events ?? []).map(e => ({
          date:       e.gameDate,
          opponent:   e.opponent?.displayName,
          score:      e.score,
          result:     e.gameResult,  // 'W' | 'L' | 'D'
          competition: e.competitionName,
        })),
      }
    }

    return {
      home: parseTeam(lastFive[0]),
      away: parseTeam(lastFive[1]),
    }
  } catch {
    return null
  }
}

// ─── Matching fuzzy de equipos ────────────────────────────────────────────────

/**
 * Normaliza un nombre de equipo para matching robusto:
 *   - minúsculas
 *   - elimina diacríticos (São → sao, München → munchen)
 *   - elimina puntuación y palabras genéricas (FC, CF, SC, AC, AS, RB, SV, VfB…)
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')                          // descompone ã → a + ̃
    .replace(/[\u0300-\u036f]/g, '')           // elimina los combining diacritics
    // Casos especiales holandeses
    .replace(/\bado den haag\b/g, 'den haag')   // ADO Den Haag → den haag
    .replace(/\bfc den haag\b/g, 'den haag')
    .replace(/\bfc groningen\b/g, 'groningen')
    .replace(/\bpsv eindhoven\b/g, 'eindhoven psv')
    .replace(/\bajax amsterdam\b/g, 'ajax')
    .replace(/\baz alkmaar\b/g, 'alkmaar')
    // Prefijos genéricos
    .replace(/\b(fc|cf|sc|ac|as|rb|sv|vfb|bv|fk|sk|afc|bsc|ssv|fsv|tsv|vfl|ado)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calcula un score de similitud entre dos nombres normalizados.
 * 0 = sin match, 1 = match perfecto.
 */
function similarity(a, b) {
  if (a === b) return 1

  // Match por contenido: uno contiene al otro
  if (a.includes(b) || b.includes(a)) return 0.9

  // Match por tokens: al menos la mitad de tokens coinciden
  const tokA = new Set(a.split(' ').filter(t => t.length > 2))
  const tokB = new Set(b.split(' ').filter(t => t.length > 2))
  if (!tokA.size || !tokB.size) return 0
  let shared = 0
  for (const t of tokA) if (tokB.has(t)) shared++
  const ratio = shared / Math.max(tokA.size, tokB.size)
  return ratio >= 0.5 ? ratio : 0
}

/**
 * Busca el partido en el formMap usando matching multi-nivel:
 *  1. Exact (normalizado)
 *  2. Fuzzy por contenido / tokens (con umbral)
 */
function findInFormMap(formMap, homeName, awayName) {
  const homeN = normalizeName(homeName)
  const awayN = normalizeName(awayName)

  let bestScore = 0
  let bestVal   = null

  for (const [key, val] of formMap) {
    const [kHome, kAway] = key.split('|')
    const kHomeN = normalizeName(kHome)
    const kAwayN = normalizeName(kAway)

    const sHome = similarity(homeN, kHomeN)
    const sAway = similarity(awayN, kAwayN)
    const score = sHome * sAway   // ambos deben matchear

    if (score > bestScore && score >= 0.4) {
      bestScore = score
      bestVal   = val
    }
  }

  // Debug: si no se encontró, loguear para investigar
  if (!bestVal) {
    console.debug(
      `[ESPN] No match: "${homeName}" vs "${awayName}" (normalized: "${homeN}" vs "${awayN}")`
    )
  }

  return bestVal
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Enriquece un array de matches (de The Odds API) con la forma real de ESPN.
 *
 * Estrategia:
 *   1. Agrupa matches por liga (espn slug)
 *   2. Por cada liga hace UN solo request al scoreboard (eficiente)
 *   3. Hace matching por nombre de equipo
 *   4. Opcionalmente enriquece con lastFiveGames si el match es encontrado
 *
 * @param {EnrichedMatch[]} matches  — array de oddsApiService
 * @param {object}          options
 * @param {boolean}         options.detailed  — si true fetcha lastFiveGames (más lento)
 * @returns {Promise<EnrichedMatch[]>}  — mismos matches con .form poblado
 */
export async function enrichMatchesWithESPNForm(matches, { detailed = false } = {}) {
  // Agrupar por liga ESPN
  const byLeague = new Map()
  for (const match of matches) {
    const slug = ODDS_TO_ESPN[match.sportKey]
    if (!slug) continue
    if (!byLeague.has(slug)) byLeague.set(slug, [])
    byLeague.get(slug).push(match)
  }

  // Fetch scoreboard por liga en paralelo
  const formMaps = new Map()
  await Promise.all(
    [...byLeague.keys()].map(async (slug) => {
      try {
        const map = await fetchFormFromScoreboard(slug)
        formMaps.set(slug, map)
        console.info(`[ESPN] ${slug}: ${map.size} partidos con forma ✓`)
        
        // Debug: mostrar equipos disponibles para Eredivisie
        if (slug === 'ned.1' && map.size > 0) {
          const teams = [...map.keys()].map(k => k.split('|').join(' vs '))
          console.debug(`[ESPN] Eredivisie partidos disponibles:`, teams.slice(0, 5))
        }
      } catch (err) {
        console.warn(`[ESPN] No se pudo obtener scoreboard de ${slug}:`, err.message)
        formMaps.set(slug, new Map())
      }
    })
  )

  // Enriquecer cada match
  const enriched = await Promise.all(
    matches.map(async (match) => {
      const slug    = ODDS_TO_ESPN[match.sportKey]
      const formMap = slug ? formMaps.get(slug) : null

      if (!formMap) {
        console.debug(`[ESPN] Liga no cubierta: ${match.sportKey} → ${match.league}`)
        return match  // liga no cubierta por ESPN
      }

      const entry = findInFormMap(formMap, match.home, match.away)
      if (!entry) {
        // Debug mejorado: mostrar qué equipos están disponibles en la liga
        if (formMap.size > 0) {
          const availableTeams = [...formMap.values()].slice(0, 3).map(v => `${v.homeName} vs ${v.awayName}`)
          console.debug(
            `[ESPN] No match para "${match.home} vs ${match.away}" en ${slug}. ` +
            `Ejemplos disponibles: ${availableTeams.join(', ')}`
          )
        }
        return match    // partido no encontrado en scoreboard
      }

      let lastFive = null
      if (detailed && entry.espnEventId) {
        lastFive = await fetchLastFiveGames(slug, entry.espnEventId)
      }

      return {
        ...match,
        form: {
          home: {
            form:      entry.homeForm,
            avgRating: null,
            position:  null,
            value:     null,
            lastFive:  lastFive?.home ?? null,
          },
          away: {
            form:      entry.awayForm,
            avgRating: null,
            position:  null,
            value:     null,
            lastFive:  lastFive?.away ?? null,
          },
        },
      }
    })
  )

  const withForm = enriched.filter(m => m.form !== null).length
  console.info(`[ESPN] Forma enriquecida en ${withForm}/${matches.length} partidos`)

  return enriched
}

/**
 * Devuelve los slugs de ESPN disponibles para una lista de sport_keys de Odds API.
 * Útil para debug.
 */
export function getSupportedLeagues() {
  return Object.entries(ODDS_TO_ESPN).map(([oddsKey, espnSlug]) => ({
    oddsKey,
    espnSlug,
  }))
}


// ─── Búsqueda de resultados finales ───────────────────────────────────────────

/**
 * Busca el resultado final de un partido en ESPN por nombres de equipos y fecha.
 * 
 * @param {string} homeTeam
 * @param {string} awayTeam
 * @param {string} date - YYYY-MM-DD
 * @param {string} sportKey - sport_key de Odds API (ej: 'soccer_usa_mls')
 * @returns {Promise<{homeScore: number, awayScore: number, winner: 'home'|'away'|'draw', status: string}|null>}
 */
export async function findMatchResultByTeams(homeTeam, awayTeam, date, sportKey) {
  try {
    const espnSlug = ODDS_TO_ESPN[sportKey]
    if (!espnSlug) {
      console.debug(`[ESPN Results] Liga no cubierta: ${sportKey}`)
      return null
    }

    const data = await safeFetch(`${ESPN_BASE}/${espnSlug}/scoreboard?dates=${date.replace(/-/g, '')}`)
    const events = data?.events ?? []

    const homeN = normalizeName(homeTeam)
    const awayN = normalizeName(awayTeam)

    for (const event of events) {
      const comp = event.competitions?.[0]
      const competitors = comp?.competitors ?? []
      
      const home = competitors.find(c => c.homeAway === 'home')
      const away = competitors.find(c => c.homeAway === 'away')

      if (!home || !away) continue

      const eHomeN = normalizeName(home.team?.displayName ?? '')
      const eAwayN = normalizeName(away.team?.displayName ?? '')

      const sHome = similarity(homeN, eHomeN)
      const sAway = similarity(awayN, eAwayN)
      
      if (sHome >= 0.4 && sAway >= 0.4) {
        // Match encontrado, verificar si terminó
        const status = comp.status?.type?.name ?? 'scheduled'
        
        if (status === 'STATUS_FINAL' || status === 'STATUS_FULL_TIME') {
          const homeScore = parseInt(home.score) || 0
          const awayScore = parseInt(away.score) || 0
          
          let winner = 'draw'
          if (homeScore > awayScore) winner = 'home'
          else if (awayScore > homeScore) winner = 'away'

          console.info(
            `[ESPN Results] "${homeTeam} vs ${awayTeam}": ${homeScore}-${awayScore} (${winner})`
          )

          return {
            homeScore,
            awayScore,
            winner,
            status: 'finished',
          }
        } else {
          console.debug(`[ESPN Results] "${homeTeam} vs ${awayTeam}": aún en curso (${status})`)
          return null
        }
      }
    }

    console.debug(`[ESPN Results] "${homeTeam} vs ${awayTeam}": no encontrado en ESPN ${espnSlug}`)
    return null
  } catch (err) {
    console.warn(`[ESPN Results] Error buscando resultado:`, err.message)
    return null
  }
}

/**
 * Busca resultados de múltiples partidos en ESPN.
 * 
 * @param {Array<{homeTeam, awayTeam, date, sportKey}>} matches
 * @returns {Promise<Map<string, MatchResult>>} - Map keyed by "${homeTeam}|${awayTeam}"
 */
export async function findMultipleResults(matches) {
  const results = await Promise.all(
    matches.map(async (m) => {
      const result = await findMatchResultByTeams(m.homeTeam, m.awayTeam, m.date, m.sportKey)
      const key = `${m.homeTeam}|${m.awayTeam}`
      return [key, result]
    })
  )
  
  return new Map(results.filter(([, result]) => result !== null))
}
