/**
 * oddsApiService.js
 * Cliente para The Odds API v4 — https://the-odds-api.com
 *
 * Se usa como segundo fallback cuando Sofascore no está disponible.
 * Devuelve partidos con cuotas REALES de Pinnacle / Bet365 / Unibet.
 *
 * Estructura de respuesta de the-odds-api:
 * [
 *   {
 *     id, sport_key, sport_title, commence_time,
 *     home_team, away_team,
 *     bookmakers: [
 *       { key, title, markets: [{ key:"h2h", outcomes:[{name, price}] }] }
 *     ]
 *   }
 * ]
 */

import { enrichMatchesWithESPNForm } from './espnService.js'

const BASE_URL = 'https://api.the-odds-api.com/v4'

// Preferencia de casas: Pinnacle (la referencia sharp) → Bet365 → Unibet → cualquiera
const BOOKMAKER_PRIORITY = ['pinnacle', 'bet365', 'unibet']

// Ligas de fútbol que cubre la API (sport_key)
// https://the-odds-api.com/sports-odds-data/sports-apis.html
const SOCCER_SPORTS = [
  'soccer_epl',              // Premier League
  'soccer_spain_la_liga',    // La Liga
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_france_ligue_one',
  'soccer_uefa_champs_league',
  'soccer_uefa_europa_league',
  'soccer_netherlands_eredivisie',
  'soccer_portugal_primeira_liga',
  'soccer_turkey_super_league',
  'soccer_brazil_campeonato',
  'soccer_argentina_primera_division',
  'soccer_mexico_ligamx',
  'soccer',                  // fallback genérico
]

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Elige la mejor casa de apuestas según BOOKMAKER_PRIORITY.
 * Si ninguna de las preferidas está disponible usa la primera que haya.
 */
function pickBestBookmaker(bookmakers) {
  if (!bookmakers?.length) return null
  for (const key of BOOKMAKER_PRIORITY) {
    const bm = bookmakers.find(b => b.key === key)
    if (bm) return bm
  }
  return bookmakers[0]
}

/**
 * Extrae cuotas 1X2 del mercado h2h de una casa de apuestas.
 * Devuelve { homeOdds, drawOdds, awayOdds, homeImplied, drawImplied, awayImplied, overround }
 * o null si no hay datos suficientes.
 */
function extractOdds(bookmaker, homeTeam, awayTeam) {
  const h2h = bookmaker?.markets?.find(m => m.key === 'h2h')
  if (!h2h) return null

  const outcomes = h2h.outcomes ?? []

  // La API devuelve los outcomes con el nombre del equipo como key
  // El empate viene como "Draw"
  const findPrice = (name) =>
    outcomes.find(o => o.name === name || o.name === 'Draw' && name === 'Draw')?.price

  const o1 = findPrice(homeTeam)
  const oX = outcomes.find(o => o.name === 'Draw')?.price
  const o2 = findPrice(awayTeam)

  if (!o1 || !oX || !o2) return null

  const raw1 = 1 / o1, rawX = 1 / oX, raw2 = 1 / o2
  const total = raw1 + rawX + raw2

  return {
    homeOdds:    parseFloat(o1.toFixed(3)),
    drawOdds:    parseFloat(oX.toFixed(3)),
    awayOdds:    parseFloat(o2.toFixed(3)),
    homeImplied: parseFloat(((raw1 / total) * 100).toFixed(1)),
    drawImplied: parseFloat(((rawX / total) * 100).toFixed(1)),
    awayImplied: parseFloat(((raw2 / total) * 100).toFixed(1)),
    overround:   parseFloat(((total - 1) * 100).toFixed(2)),
    bookmaker:   bookmaker.title,  // para mostrar la fuente en la UI
  }
}

/**
 * Convierte un evento de the-odds-api al formato EnrichedMatch que usa el resto de la app.
 */
function normalizeEvent(event) {
  const dt   = new Date(event.commence_time)
  const pad  = (n) => String(n).padStart(2, '0')
  const date = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
  const time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`

  const bm   = pickBestBookmaker(event.bookmakers)
  const odds = bm ? extractOdds(bm, event.home_team, event.away_team) : null

  return {
    id:           event.id,
    home:         event.home_team,
    away:         event.away_team,
    league:       event.sport_title,
    sportKey:     event.sport_key,
    date,
    time,
    status:       'Not started',
    odds,
    form:         null,  // The Odds API no provee forma — Groq la estimará
    source:       'odds-api',
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Obtiene todos los partidos de fútbol disponibles con cuotas reales.
 *
 * Usa el endpoint /sports/soccer/odds que devuelve todos los deportes
 * de fútbol en un solo request (más eficiente en cuota de API).
 *
 * @param {string} apiKey  - API Key de The Odds API
 * @param {object} options
 * @param {number} options.limit  - máx partidos a devolver (default 20)
 * @returns {Promise<EnrichedMatch[]>}
 */
export async function loadMatchesFromOddsApi(apiKey, { limit = 20 } = {}) {
  if (!apiKey?.trim()) throw new Error('ODDS_API_KEY_MISSING')

  // Un solo request con todos los sports de soccer disponibles
  const params = new URLSearchParams({
    apiKey,
    regions:     'eu',
    markets:     'h2h',
    oddsFormat:  'decimal',
    dateFormat:  'iso',
    bookmakers:  BOOKMAKER_PRIORITY.join(','),
  })

  const res = await fetch(
    `${BASE_URL}/sports/soccer/odds/?${params}`,
    { headers: { Accept: 'application/json' } }
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg  = body?.message ?? `HTTP ${res.status}`
    throw new Error(`Odds API error: ${msg}`)
  }

  // Loguear cuota de API restante
  const remaining = res.headers.get('x-requests-remaining')
  const used      = res.headers.get('x-requests-used')
  if (remaining !== null) {
    console.info(
      `[Odds API] Requests usados: ${used} | Restantes: ${remaining}`
    )
  }

  const data = await res.json()

  // Filtrar solo partidos futuros (algunos endpoints devuelven en curso)
  const now      = Date.now()
  const upcoming = data
    .filter(e => new Date(e.commence_time).getTime() > now - 60_000)
    .slice(0, limit)

  const normalized = upcoming.map(normalizeEvent)

  // Enriquecer con forma real de ESPN (sin costo de API adicional)
  console.info('[Odds API] Enriqueciendo con forma de ESPN...')
  try {
    return await enrichMatchesWithESPNForm(normalized)
  } catch (err) {
    console.warn('[ESPN] No se pudo enriquecer con forma:', err.message)
    return normalized
  }
}
