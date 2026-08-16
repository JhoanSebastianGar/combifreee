/**
 * useMatchResults.js
 * Hook para polling automático de resultados de partidos desde Sofascore.
 *
 * Estrategia:
 *   - Polling cada 30 segundos mientras haya partidos pendientes en el historial
 *   - Solo hace requests para partidos con estado "Pendiente"
 *   - Actualiza automáticamente el estado en el historial cuando termina un partido
 */

import { useState, useEffect, useRef } from 'react'
import { findMultipleResults } from '../services/espnService.js'

const POLLING_INTERVAL_MS = 30_000  // 30 segundos

/**
 * Intenta detectar el sportKey basándose en el nombre de la liga.
 */
function detectSportKey(leagueName) {
  const ln = leagueName.toLowerCase()
  
  if (ln.includes('premier') || ln.includes('england') || ln.includes('epl')) return 'soccer_epl'
  if (ln.includes('la liga') || ln.includes('spain') || ln.includes('españa')) return 'soccer_spain_la_liga'
  if (ln.includes('bundesliga') || ln.includes('germany') || ln.includes('alemania')) return 'soccer_germany_bundesliga'
  if (ln.includes('serie a') || ln.includes('italy') || ln.includes('italia')) return 'soccer_italy_serie_a'
  if (ln.includes('ligue 1') || ln.includes('france') || ln.includes('francia')) return 'soccer_france_ligue_one'
  if (ln.includes('eredivisie') || ln.includes('netherlands') || ln.includes('holanda')) return 'soccer_netherlands_eredivisie'
  if (ln.includes('liga mx') || ln.includes('mexico') || ln.includes('méxico')) return 'soccer_mexico_ligamx'
  if (ln.includes('mls') || ln.includes('major league soccer')) return 'soccer_usa_mls'
  if (ln.includes('brasileir') || ln.includes('brazil') || ln.includes('brasil')) return 'soccer_brazil_campeonato'
  if (ln.includes('argentina') || ln.includes('primera division')) return 'soccer_argentina_primera_division'
  if (ln.includes('primeira liga') || ln.includes('portugal')) return 'soccer_portugal_primeira_liga'
  if (ln.includes('super lig') || ln.includes('turkey') || ln.includes('turquía')) return 'soccer_turkey_super_league'
  if (ln.includes('champions league') || ln.includes('uefa champions')) return 'soccer_uefa_champs_league'
  if (ln.includes('europa league') || ln.includes('uefa europa')) return 'soccer_uefa_europa_league'
  
  return null
}

/**
 * Hook para actualizar automáticamente los resultados de partidos.
 * 
 * @param {HistoryEntry[]} pendingEntries - Entradas del historial con estado "Pendiente"
 * @param {Function} onResultUpdate - Callback(entryId, result) cuando se obtiene un resultado
 */
export function useMatchResults(pendingEntries, onResultUpdate) {
  const [isPolling, setIsPolling] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    // Si no hay partidos pendientes, detener polling
    if (!pendingEntries || pendingEntries.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        setIsPolling(false)
        console.info('[Match Results] Polling detenido: no hay partidos pendientes')
      }
      return
    }

    console.info(`[Match Results] Iniciando polling para ${pendingEntries.length} partidos pendientes`)

    // Función de polling
    const poll = async () => {
      setIsPolling(true)

      try {
        // Preparar datos para búsqueda en ESPN
        const matchesToFind = pendingEntries.map(entry => {
          const [home, away] = entry.match.split(' vs ')
          
          // Intentar obtener sportKey: primero del entry, luego detectarlo de la liga
          let sportKey = entry.sportKey
          if (!sportKey && entry.league) {
            sportKey = detectSportKey(entry.league)
            if (sportKey) {
              console.info(`[Match Results] "${entry.match}": sportKey detectado "${sportKey}" desde liga "${entry.league}"`)
            }
          }
          
          return {
            homeTeam: home?.trim() || '',
            awayTeam: away?.trim() || '',
            date: entry.date,
            sportKey: sportKey || 'soccer_epl',  // fallback a Premier League
            entryId: entry.id,
            league: entry.league,
          }
        }).filter(m => m.homeTeam && m.awayTeam && m.date)

        if (matchesToFind.length === 0) {
          console.warn('[Match Results] No hay partidos con datos válidos para polling')
          setIsPolling(false)
          return
        }

        console.info(`[Match Results] Buscando resultados en ESPN para ${matchesToFind.length} partidos...`)
        
        // Log de cada partido que se va a buscar
        matchesToFind.forEach(m => {
          console.debug(`[Match Results] → "${m.homeTeam} vs ${m.awayTeam}" en ${m.sportKey} (${m.league || 'sin liga'})`)
        })

        // Buscar resultados en ESPN
        const results = await findMultipleResults(matchesToFind)

        if (results.size > 0) {
          console.info(`[Match Results] ${results.size} partidos finalizados`)

          // Actualizar cada entrada que tenga resultado
          for (const matchData of matchesToFind) {
            const key = `${matchData.homeTeam}|${matchData.awayTeam}`
            const result = results.get(key)

            if (result) {
              const entry = pendingEntries.find(e => e.id === matchData.entryId)
              if (!entry) continue

              console.info(
                `[Match Results] Resultado de ${entry.match}: ${result.homeScore}-${result.awayScore} (${result.winner})`
              )
              
              // Determinar si la apuesta ganó según el mercado
              const won = checkIfWon(entry, result)
              
              console.info(`[Match Results] Apuesta en "${entry.selection}": ${won ? '✅ Ganada' : '❌ Perdida'}`)

              onResultUpdate?.(entry.id, {
                result,
                won,
                homeScore: result.homeScore,
                awayScore: result.awayScore,
              })
            }
          }

          setLastUpdate(new Date())
        } else {
          console.info('[Match Results] Ningún partido ha finalizado aún')
        }
      } catch (err) {
        console.warn('[Match Results] Error en polling:', err.message)
      } finally {
        setIsPolling(false)
      }
    }

    // Primer poll inmediato
    poll()

    // Configurar intervalo
    intervalRef.current = setInterval(poll, POLLING_INTERVAL_MS)

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [pendingEntries, onResultUpdate])

  return { isPolling, lastUpdate }
}

/**
 * Determina si una apuesta ganó según el resultado del partido.
 */
function checkIfWon(entry, result) {
  const { market, selection } = entry
  const { winner, homeScore, awayScore } = result

  // Mercado 1X2
  if (market === '1X2') {
    if (selection === 'Victoria Local' || selection.includes('Local')) {
      return winner === 'home'
    }
    if (selection === 'Empate' || selection.includes('Empate')) {
      return winner === 'draw'
    }
    if (selection === 'Victoria Visitante' || selection.includes('Visitante')) {
      return winner === 'away'
    }
  }

  // Mercado Más/Menos Goles
  if (market.includes('Más/Menos')) {
    const totalGoles = homeScore + awayScore
    
    // Extraer línea del market o selection
    const lineMatch = (market + ' ' + selection).match(/(\d+\.?\d*)/)
    if (!lineMatch) return null
    
    const line = parseFloat(lineMatch[1])
    
    if (selection.includes('Más')) {
      return totalGoles > line
    }
    if (selection.includes('Menos')) {
      return totalGoles < line
    }
  }

  // Mercado BTTS
  if (market === 'BTTS' || market.includes('Ambos')) {
    const bothScored = homeScore > 0 && awayScore > 0
    if (selection.includes('Sí')) {
      return bothScored
    }
    if (selection.includes('No')) {
      return !bothScored
    }
  }

  return null
}
