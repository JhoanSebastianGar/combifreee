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
  }
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useHistorial() {
  const [entries, setEntries] = useState(() => load())

  const persist = useCallback((next) => {
    setEntries(next)
    save(next)
  }, [])

  /** Añade una apuesta al historial. Devuelve false si ya existe. */
  const addEntry = useCallback((opportunity) => {
    const dup = entries.some(
      e =>
        e.match     === (opportunity.match ?? `${opportunity.home} vs ${opportunity.away}`) &&
        e.market    === opportunity.market &&
        e.selection === opportunity.selection &&
        e.date      === opportunity.date
    )
    if (dup) return false

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
    persist([entry, ...entries])
    return true
  }, [entries, persist])

  /** Cambia el estado de una apuesta. */
  const updateStatus = useCallback((id, status) => {
    persist(entries.map(e => e.id === id ? { ...e, status } : e))
  }, [entries, persist])

  /** Cambia el stake de una apuesta. */
  const updateStake = useCallback((id, stake) => {
    const val = parseFloat(stake)
    if (isNaN(val) || val <= 0) return
    persist(entries.map(e => e.id === id ? { ...e, stake: val } : e))
  }, [entries, persist])

  /** Elimina una apuesta del historial. */
  const removeEntry = useCallback((id) => {
    persist(entries.filter(e => e.id !== id))
  }, [entries, persist])

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
    removeEntry,
    clearAll,
  }
}
