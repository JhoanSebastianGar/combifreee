/**
 * sofascoreService.js
 * Cliente para la API no-oficial de Sofascore.
 *
 * Cadena de resiliencia (tres capas):
 *   1. Sofascore  → datos completos (cuotas + forma pre-partido)
 *   2. Odds API   → cuotas reales de Pinnacle/Bet365 (sin forma)
 *   3. mockMatches.json → datos estáticos de ejemplo (último recurso)
 *
 * ⚠️  La API de Sofascore no está documentada oficialmente — puede cambiar sin aviso.
 */

import mockMatchesData            from '../data/mockMatches.json'
import { loadMatchesFromOddsApi } from './oddsApiService.js'
import { enrichWithAPIFootball }  from './apiFootballService.js'

// En desarrollo usamos el proxy de Vite para evitar CORS.
// En producción habría que configurar un proxy real (Nginx, Cloudflare Worker, etc.)
const BASE = import.meta.env.DEV
  ? '/api-sofascore'                     // → proxy Vite → https://api.sofascore.app/api/v1
  : 'https://api.sofascore.app/api/v1'  // directo (solo si el host del usuario no está bloqueado)

const BROWSER_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
}

const TIMEOUT_MS = 8000
const MAX_EVENTS = 20

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * fetch con timeout. Propaga errores para que el llamador haga fallback.
 */
async function safeFetch(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP_${res.status}`)
    return await res.json()
  } catch (err) {
    clearTimeout(timer)
    throw err.name === 'AbortError' ? new Error('TIMEOUT') : err
  }
}

// ─── capas de datos ───────────────────────────────────────────────────────────

async function fetchScheduledEvents(date) {
  const d = date ?? new Date().toISOString().split('T')[0]
  const data = await safeFetch(`${BASE}/sport/football/scheduled-events/${d}`)
  return data?.events ?? []
}

async function fetchOdds(eventId) {
  try {
    const data = await safeFetch(`${BASE}/event/${eventId}/odds/1/all`)
    const markets = data?.markets ?? []
    
    // ── Mercado 1X2 ────────────────────────────────────────────────────────
    const market1x2 = markets.find(
      m =>
        m.marketName === 'Full time' ||
        m.marketName === '1X2' ||
        m.marketName?.toLowerCase().includes('full time')
    )

    const parseOdd = (v) => {
      if (!v) return null
      const s = String(v)
      if (s.includes('/')) {
        const [n, d] = s.split('/').map(Number)
        return parseFloat((n / d + 1).toFixed(3))
      }
      return parseFloat(s)
    }

    let odds1x2 = null
    if (market1x2) {
      const choices = market1x2.choices ?? []
      const find = (n) => choices.find(c => c.name === n || c.sourceId === n)
      const home = find('1') ?? find('Home')
      const draw = find('X') ?? find('Draw')
      const away = find('2') ?? find('Away')
      
      if (home && draw && away) {
        const o1 = parseOdd(home.fractionalValue)
        const oX = parseOdd(draw.fractionalValue)
        const o2 = parseOdd(away.fractionalValue)
        
        if (o1 && oX && o2) {
          const raw1 = 1 / o1, rawX = 1 / oX, raw2 = 1 / o2
          const total = raw1 + rawX + raw2
          
          odds1x2 = {
            homeOdds:    o1,
            drawOdds:    oX,
            awayOdds:    o2,
            homeImplied: parseFloat(((raw1 / total) * 100).toFixed(1)),
            drawImplied: parseFloat(((rawX / total) * 100).toFixed(1)),
            awayImplied: parseFloat(((raw2 / total) * 100).toFixed(1)),
            overround:   parseFloat(((total - 1) * 100).toFixed(2)),
          }
        }
      }
    }

    // ── Mercado Más/Menos Goles ────────────────────────────────────────────
    // Sofascore usa "Over/Under" o "Total goals"
    const marketTotals = markets.find(
      m =>
        m.marketName?.toLowerCase().includes('over/under') ||
        m.marketName?.toLowerCase().includes('total goals') ||
        m.marketName?.toLowerCase().includes('goals o/u')
    )

    let totals = null
    if (marketTotals) {
      const choices = marketTotals.choices ?? []
      
      // Buscar líneas 2.5 y 1.5
      const findLine = (line) => {
        const over = choices.find(c => 
          (c.name?.includes(`Over ${line}`) || c.sourceId?.includes(`over_${line}`)) &&
          c.fractionalValue
        )
        const under = choices.find(c => 
          (c.name?.includes(`Under ${line}`) || c.sourceId?.includes(`under_${line}`)) &&
          c.fractionalValue
        )
        
        if (!over || !under) return null
        
        const oOver = parseOdd(over.fractionalValue)
        const oUnder = parseOdd(under.fractionalValue)
        if (!oOver || !oUnder) return null
        
        const rawOver = 1 / oOver, rawUnder = 1 / oUnder
        const totalProb = rawOver + rawUnder
        
        return {
          line:          parseFloat(line),
          overOdds:      oOver,
          underOdds:     oUnder,
          overImplied:   parseFloat(((rawOver / totalProb) * 100).toFixed(1)),
          underImplied:  parseFloat(((rawUnder / totalProb) * 100).toFixed(1)),
          overround:     parseFloat(((totalProb - 1) * 100).toFixed(2)),
        }
      }

      const line25 = findLine('2.5')
      const line15 = findLine('1.5')
      
      if (line25 || line15) {
        totals = { line25, line15 }
      }
    }

    // Devolver ambos mercados (puede ser que solo uno esté disponible)
    if (!odds1x2 && !totals) return null
    
    return {
      ...(odds1x2 || {}),
      totals,
    }
  } catch {
    return null
  }
}

async function fetchPregameForm(eventId) {
  try {
    const data = await safeFetch(`${BASE}/event/${eventId}/pregame-form`)
    const norm = (t) =>
      t
        ? {
            form:      t.form ?? '',
            avgRating: t.avgRating ?? null,
            position:  t.position ?? null,
            value:     t.value ?? null,
          }
        : null
    return { home: norm(data?.homeTeam), away: norm(data?.awayTeam) }
  } catch {
    return null
  }
}

function normalizeEvent(event) {
  const dt  = new Date((event.startTimestamp ?? 0) * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return {
    id:           event.id,
    home:         event.homeTeam?.name ?? 'Local',
    away:         event.awayTeam?.name ?? 'Visitante',
    homeId:       event.homeTeam?.id,
    awayId:       event.awayTeam?.id,
    league:       event.tournament?.name ?? event.season?.name ?? 'Liga desconocida',
    tournamentId: event.tournament?.uniqueTournament?.id ?? null,
    seasonId:     event.season?.id ?? null,
    date:         `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time:         `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
    status:       event.status?.description ?? 'Not started',
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Carga partidos con cuotas y forma usando la cadena de resiliencia:
 *   1. Sofascore (cuotas + forma real)
 *   2. The Odds API (cuotas reales de Pinnacle/Bet365, sin forma)
 *   3. mockMatches.json (último recurso, datos estáticos)
 *
 * Nunca lanza un error al usuario — siempre devuelve datos.
 *
 * @param {string?}  date
 * @param {object}   options
 * @param {number}   options.limit             máx partidos (default 20)
 * @param {string?}  options.oddsApiKey        API Key de The Odds API
 * @param {string?}  options.apiFootballKey    API Key de API-Football
 * @param {Function} options.onProgress        callback(loaded, total)
 * @returns {Promise<{ matches: EnrichedMatch[], source: 'sofascore'|'odds-api'|'mock' }>}
 */
export async function loadMatchesForDate(date, { limit = MAX_EVENTS, oddsApiKey, apiFootballKey, onProgress } = {}) {

  // ── Capa 1: Sofascore ───────────────────────────────────────────────────────
  try {
    const rawEvents = await fetchScheduledEvents(date)
    if (!rawEvents.length) throw new Error('SIN_PARTIDOS')

    const upcoming = rawEvents
      .filter(e => e.status?.type === 'notstarted' || e.status?.description === 'Not started')
      .slice(0, limit)
    if (!upcoming.length) throw new Error('SIN_PENDIENTES')

    const total  = upcoming.length
    let   loaded = 0
    const BATCH  = 5
    const enriched = []

    for (let i = 0; i < upcoming.length; i += BATCH) {
      const results = await Promise.all(
        upcoming.slice(i, i + BATCH).map(async (event) => {
          const base = normalizeEvent(event)
          const [odds, form] = await Promise.all([
            fetchOdds(event.id),
            fetchPregameForm(event.id),
          ])
          onProgress?.(++loaded, total)
          return { ...base, odds, form }
        })
      )
      enriched.push(...results)
    }

    console.info('[Football Value Finder] Datos obtenidos de Sofascore ✓')
    
    // Enriquecer con API-Football (H2H, standings, home advantage)
    const finalMatches = await enrichWithAPIFootball(enriched, apiFootballKey)
    return { matches: finalMatches, source: 'sofascore' }

  } catch (sofascoreErr) {
    console.warn('[Football Value Finder] Sofascore no disponible:', sofascoreErr.message)

    // ── Capa 2: The Odds API ──────────────────────────────────────────────────
    if (oddsApiKey?.trim()) {
      try {
        console.info('[Football Value Finder] Intentando The Odds API...')
        const matches = await loadMatchesFromOddsApi(oddsApiKey, { limit })

        if (!matches.length) throw new Error('SIN_PARTIDOS_ODDS_API')

        // Simular progreso para el spinner
        for (let i = 0; i < matches.length; i++) {
          await new Promise(r => setTimeout(r, 60))
          onProgress?.(i + 1, matches.length)
        }

        console.info(`[Football Value Finder] ${matches.length} partidos obtenidos de The Odds API ✓`)
        
        // Enriquecer con API-Football (H2H, standings, home advantage)
        const finalMatches = await enrichWithAPIFootball(matches, apiFootballKey)
        return { matches: finalMatches, source: 'odds-api' }

      } catch (oddsApiErr) {
        console.warn('[Football Value Finder] The Odds API no disponible:', oddsApiErr.message)
      }
    }

    // ── Capa 3: Mock local ────────────────────────────────────────────────────
    console.warn('[Football Value Finder] Usando datos simulados (mockMatches.json) como último recurso.')

    const mocks = mockMatchesData.slice(0, limit)
    for (let i = 0; i < mocks.length; i++) {
      await new Promise(r => setTimeout(r, 140))
      onProgress?.(i + 1, mocks.length)
    }

    return { matches: mocks, source: 'mock' }
  }
}

/**
 * Formatea un EnrichedMatch para el prompt de Groq.
 */
export function formatMatchForPrompt(match) {
  const lines = [
    `ID:${match.id} | ${match.home} vs ${match.away}`,
    `Liga: ${match.league} | Fecha: ${match.date} ${match.time}`,
  ]

  // ── Cuotas 1X2 ────────────────────────────────────────────────────────────
  if (match.odds) {
    const o = match.odds
    if (o.homeOdds && o.drawOdds && o.awayOdds) {
      lines.push(
        `Cuotas 1X2: Local ${o.homeOdds} (${o.homeImplied}%) | Empate ${o.drawOdds} (${o.drawImplied}%) | Visitante ${o.awayOdds} (${o.awayImplied}%) | Margen: ${o.overround}%`
      )
    }
    
    // ── Cuotas Más/Menos Goles ────────────────────────────────────────────
    if (o.totals) {
      const parts = []
      if (o.totals.line25) {
        const t = o.totals.line25
        parts.push(`2.5: Más ${t.overOdds} (${t.overImplied}%) / Menos ${t.underOdds} (${t.underImplied}%)`)
      }
      if (o.totals.line15) {
        const t = o.totals.line15
        parts.push(`1.5: Más ${t.overOdds} (${t.overImplied}%) / Menos ${t.underOdds} (${t.underImplied}%)`)
      }
      if (parts.length) {
        lines.push(`Cuotas Totals: ${parts.join(' | ')}`)
      }
    }
  } else {
    lines.push('Cuotas: no disponibles')
  }

  // ── Forma reciente ────────────────────────────────────────────────────────
  if (match.form) {
    const fh = match.form.home
    const fa = match.form.away
    if (fh)
      lines.push(
        `Forma local: ${fh.form || 'N/D'}${fh.position ? ` | Pos. liga: ${fh.position}` : ''}`
      )
    if (fa)
      lines.push(
        `Forma visitante: ${fa.form || 'N/D'}${fa.position ? ` | Pos. liga: ${fa.position}` : ''}`
      )
  }

  // ── Datos avanzados de API-Football ───────────────────────────────────────
  if (match.apiFb) {
    const fb = match.apiFb

    // H2H (últimos 5 enfrentamientos directos)
    if (fb.h2h?.length) {
      const h2hSummary = fb.h2h.map(h => {
        const score = `${h.homeScore}-${h.awayScore}`
        const winner = h.winner === 'home' ? '🏠' : h.winner === 'away' ? '✈️' : '🤝'
        return `${winner} ${score} (${h.date})`
      }).join(', ')
      lines.push(`H2H últimos ${fb.h2h.length}: ${h2hSummary}`)
    }

    // Posición en tabla
    if (fb.homeStanding || fb.awayStanding) {
      const home = fb.homeStanding
        ? `${match.home}: ${home.rank}° · ${home.points}pts (${home.played} PJ)`
        : `${match.home}: N/D`
      const away = fb.awayStanding
        ? `${match.away}: ${away.rank}° · ${away.points}pts (${away.played} PJ)`
        : `${match.away}: N/D`
      lines.push(`Tabla: ${home} | ${away}`)
    }

    // Ventaja de local (% victorias en casa)
    if (fb.homeAdvantage != null) {
      lines.push(`Ventaja local: ${match.home} gana ${fb.homeAdvantage}% en casa esta temporada`)
    }
  }

  return lines.join('\n')
}
