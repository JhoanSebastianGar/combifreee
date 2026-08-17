/**
 * useHistorial.js
 * Hook que gestiona el historial de apuestas en localStorage.
 *
 * Estructura de una entrada:
 * {
 *   id:        string  (uuid compacto)
 *   savedAt:   string  (ISO)
 *   match:     string  "Real Madrid vs Barcelona"
 *   league:    string
 *   date:      string  YYYY-MM-DD
 *   market:    string
 *   selection: string
 *   odds:      number
 *   ev:        number
 *   stake:     number  (1 por defecto)
 *   status:    'Pendiente' | 'Ganada' | 'Perdida' | 'Anulada'
 * }
 */

import { useState, useCallback } from 'react'

const LS_KEY = 'fvf_historial_v1'

// ─── helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(entries) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries))
  } catch (e) {
    console.warn('[Historial] No se pudo guardar en localStorage:', e)
  }
}

// ─── métricas ─────────────────────────────────────────────────────────────────

/**
 * Agrupa entries por una clave y calcula métricas para cada grupo.
 */
function groupBy(entries, keyFn) {
  const groups = {}
  
  for (const entry of entries) {
    const key = typeof keyFn === 'function' ? keyFn(entry) : entry[keyFn]
    if (!key) continue
    if (!groups[key]) groups[key] = []
    groups[key].push(entry)
  }
  
  return Object.entries(groups).map(([key, items]) => ({
    key,
    ...calcBasicMetrics(items),
  }))
}

/**
 * Calcula métricas básicas para un conjunto de entries.
 */
function calcBasicMetrics(entries) {
  const resolved = entries.filter(e => e.status === 'Ganada' || e.status === 'Perdida')
  const won = entries.filter(e => e.status === 'Ganada')
  const lost = entries.filter(e => e.status === 'Perdida')
  
  const pl = entries.reduce((acc, e) => {
    if (e.status === 'Ganada')  return acc + (e.odds - 1) * e.stake
    if (e.status === 'Perdida') return acc - e.stake
    return acc
  }, 0)
  
  const staked = resolved.reduce((acc, e) => acc + e.stake, 0)
  const yield_ = staked > 0 ? (pl / staked) * 100 : 0
  const winRate = resolved.length > 0 ? (won.length / resolved.length) * 100 : 0
  
  return {
    total: entries.length,
    won: won.length,
    lost: lost.length,
    pl: parseFloat(pl.toFixed(2)),
    yield: parseFloat(yield_.toFixed(1)),
    winRate: parseFloat(winRate.toFixed(1)),
    staked: parseFloat(staked.toFixed(2)),
  }
}

/**
 * Calcula la racha actual (victorias o derrotas consecutivas).
 */
function calculateStreak(entries) {
  const resolved = entries
    .filter(e => e.status === 'Ganada' || e.status === 'Perdida')
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
  
  if (!resolved.length) return { type: null, count: 0 }
  
  const firstStatus = resolved[0].status
  let count = 0
  
  for (const entry of resolved) {
    if (entry.status === firstStatus) count++
    else break
  }
  
  return {
    type: firstStatus === 'Ganada' ? 'winning' : 'losing',
    count,
  }
}

/**
 * Calcula el drawdown máximo (peor racha de pérdidas acumuladas).
 */
function calculateMaxDrawdown(entries) {
  const resolved = entries
    .filter(e => e.status === 'Ganada' || e.status === 'Perdida')
    .sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt))
  
  let peak = 0
  let current = 0
  let maxDrawdown = 0
  
  for (const entry of resolved) {
    if (entry.status === 'Ganada') {
      current += (entry.odds - 1) * entry.stake
    } else if (entry.status === 'Perdida') {
      current -= entry.stake
    }
    
    if (current > peak) peak = current
    
    const drawdown = peak - current
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }
  
  return parseFloat(maxDrawdown.toFixed(2))
}

/**
 * Clasifica una cuota en un rango.
 */
function getOddsRange(odds) {
  if (odds < 1.5) return '<1.5'
  if (odds < 2.0) return '1.5-2.0'
  if (odds < 3.0) return '2.0-3.0'
  if (odds < 5.0) return '3.0-5.0'
  return '>5.0'
}

/**
 * Clasifica un EV en un rango.
 */
function getEVRange(ev) {
  if (ev < 0) return '<0%'
  if (ev < 5) return '0-5%'
  if (ev < 10) return '5-10%'
  if (ev < 20) return '10-20%'
  return '>20%'
}

export function calcMetrics(entries) {
  const resolved  = entries.filter(e => e.status === 'Ganada' || e.status === 'Perdida')
  const won       = entries.filter(e => e.status === 'Ganada')
  const lost      = entries.filter(e => e.status === 'Perdida')
  const pending   = entries.filter(e => e.status === 'Pendiente')
  const voided    = entries.filter(e => e.status === 'Anulada')

  // P/L: ganadas aportan (cuota - 1) * stake, perdidas restan 1 * stake
  const pl = entries.reduce((acc, e) => {
    if (e.status === 'Ganada')  return acc + (e.odds - 1) * e.stake
    if (e.status === 'Perdida') return acc - e.stake
    return acc
  }, 0)

  // Unidades totales apostadas (sin anuladas ni pendientes para el yield)
  const staked = resolved.reduce((acc, e) => acc + e.stake, 0)

  const yield_   = staked > 0 ? (pl / staked) * 100 : 0
  const winRate  = resolved.length > 0 ? (won.length / resolved.length) * 100 : 0
  const roi      = staked > 0 ? (pl / staked) * 100 : 0

  // ── Métricas avanzadas ──────────────────────────────────────────────────────
  
  const byLeague = groupBy(resolved, 'league')
  const byMarket = groupBy(resolved, 'market')
  const byOddsRange = groupBy(resolved, e => getOddsRange(e.odds))
  const byEVRange = groupBy(resolved, e => getEVRange(e.ev))
  
  const streak = calculateStreak(entries)
  const maxDrawdown = calculateMaxDrawdown(entries)

  return {
    pl:       parseFloat(pl.toFixed(2)),
    yield:    parseFloat(yield_.toFixed(1)),
    winRate:  parseFloat(winRate.toFixed(1)),
    roi:      parseFloat(roi.toFixed(1)),
    total:    entries.length,
    won:      won.length,
    lost:     lost.length,
    pending:  pending.length,
    voided:   voided.length,
    staked:   parseFloat(staked.toFixed(2)),
    
    // Métricas avanzadas
    byLeague,
    byMarket,
    byOddsRange,
    byEVRange,
    streak,
    maxDrawdown,
  }
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useHistorial() {
  const [entries, setEntries] = useState(() => load())

  // Las actualizaciones del polling pueden llegar juntas. Usar el estado más
  // reciente evita que una actualización pise el resultado de otra.
  const persist = useCallback((updater) => {
    setEntries(current => {
      const next = typeof updater === 'function' ? updater(current) : updater
      save(next)
      return next
    })
  }, [])

  /** Añade una apuesta al historial. Devuelve false si ya existe. */
  const addEntry = useCallback((opportunity) => {
    const duplicate = entries.some(
      e =>
        e.match     === (opportunity.match ?? `${opportunity.home} vs ${opportunity.away}`) &&
        e.market    === opportunity.market &&
        e.selection === opportunity.selection &&
        e.date      === opportunity.date
    )
    if (duplicate) return false

    const entry = {
      id:        uid(),
      matchId:   opportunity.matchId ?? opportunity.id,  // Guardar ID del partido
      sportKey:  opportunity.sportKey,  // Para buscar en ESPN
      savedAt:   new Date().toISOString(),
      match:     opportunity.match ?? `${opportunity.home} vs ${opportunity.away}`,
      league:    opportunity.league ?? '',
      date:      opportunity.date   ?? '',
      time:      opportunity.time   ?? '',
      market:    opportunity.market,
      selection: opportunity.selection,
      odds:      parseFloat(opportunity.bookmakerOdds),
      ev:        parseFloat(opportunity.ev),
      stake:     1,
      status:    'Pendiente',
    }
    persist(current => [entry, ...current])
    return true
  }, [entries, persist])

  /** Cambia el estado de una apuesta. */
  const updateStatus = useCallback((id, status) => {
    persist(current => current.map(e => e.id === id ? { ...e, status } : e))
  }, [persist])

  /** Cambia el stake de una apuesta. */
  const updateStake = useCallback((id, stake) => {
    const val = parseFloat(stake)
    if (isNaN(val) || val <= 0) return
    persist(current => current.map(e => e.id === id ? { ...e, stake: val } : e))
  }, [persist])

  /** Completa datos de identificación de entradas antiguas sin alterar su estado. */
  const updateEntryMetadata = useCallback((id, metadata) => {
    persist(current => current.map(e => e.id === id ? { ...e, ...metadata } : e))
  }, [persist])

  /** Elimina una apuesta del historial. */
  const removeEntry = useCallback((id) => {
    persist(current => current.filter(e => e.id !== id))
  }, [persist])

  /** Borra todo el historial. */
  const clearAll = useCallback(() => {
    persist([])
  }, [persist])

  return {
    entries,
    metrics: calcMetrics(entries),
    addEntry,
    updateStatus,
    updateStake,
    updateEntryMetadata,
    removeEntry,
    clearAll,
  }
}
