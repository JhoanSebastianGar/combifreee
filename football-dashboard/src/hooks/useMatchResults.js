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
import { fetchMultipleResults, findMatchIdByTeams } from '../services/sofascoreService.js'

const POLLING_INTERVAL_MS = 30_000  // 30 segundos

/**
 * Intenta detectar el sportKey basándose en el nombre de la liga.
 */
function detectSportKey(leagueName) {
  if (!leagueName) return null
  // Normalizar (quita acentos y compacta)
  const normalized = leagueName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Mapeos específicos
  if (normalized.includes('premier league') && (normalized.includes('russia') || normalized.includes('rusia'))) return 'soccer_russia_premier_league'
  if (normalized.includes('premier') || normalized.includes('england') || normalized.includes('epl')) return 'soccer_epl'
  if (normalized.includes('la liga') || normalized.includes('spain') || normalized.includes('espana')) return 'soccer_spain_la_liga'
  if (normalized.includes('bundesliga 2') || normalized.includes('2. bundesliga')) return 'soccer_germany_bundesliga2'
  if (normalized.includes('bundesliga') || normalized.includes('germany') || normalized.includes('alemania')) return 'soccer_germany_bundesliga'
  if (normalized.includes('coppa italia')) return 'soccer_italy_coppa_italia'
  if (normalized.includes('serie a') || normalized.includes('italy') || normalized.includes('italia')) return 'soccer_italy_serie_a'
  if (normalized.includes('ligue 1') || normalized.includes('france') || normalized.includes('francia')) return 'soccer_france_ligue_one'
  if (normalized.includes('eredivisie') || normalized.includes('netherlands') || normalized.includes('holanda')) return 'soccer_netherlands_eredivisie' // fallback normalized key
  if (normalized.includes('liga mx') || normalized.includes('mexico') || normalized.includes('mexico')) return 'soccer_mexico_ligamx'
  if (normalized.includes('mls') || normalized.includes('major league soccer')) return 'soccer_usa_mls'
  if (normalized.includes('brasileir') || normalized.includes('brazil') || normalized.includes('brasil')) return 'soccer_brazil_campeonato'

  // Primera División por país: buscar país explícito para evitar mapas incorrectos
  if (normalized.includes('chile') || (normalized.includes('primera division') && normalized.includes('chile'))) return 'soccer_chile_primera_division'
  if (normalized.includes('argentina') || (normalized.includes('primera division') && normalized.includes('argentina'))) return 'soccer_argentina_primera_division'

  if (normalized.includes('primeira liga') || normalized.includes('portugal')) return 'soccer_portugal_primeira_liga'
  if (normalized.includes('super lig') || normalized.includes('super league') || normalized.includes('turkey') || normalized.includes('turquia')) return 'soccer_turkey_super_league'
  if (normalized.includes('k league 1') || normalized.includes('k-league 1') || normalized.includes('south korea') || normalized.includes('corea')) return 'soccer_korea_kleague1'
  if (normalized.includes('champions league') || normalized.includes('uefa champions')) return 'soccer_uefa_champs_league'
  if (normalized.includes('europa league') || normalized.includes('uefa europa')) return 'soccer_uefa_europa_league'
  
  return null
}

/**
 * Hook para actualizar automáticamente los resultados de partidos.
 * 
 * @param {HistoryEntry[]} pendingEntries - Entradas del historial con estado "Pendiente"
 * @param {Function} onResultUpdate - Callback(entryId, result) cuando se obtiene un resultado
 */
export function useMatchResults(pendingEntries, onResultUpdate, onMetadataResolved) {
  const [isPolling, setIsPolling] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const intervalRef = useRef(null)
  const pollInFlightRef = useRef(false)

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
      // Evita consultas superpuestas si una respuesta tarda más que el intervalo.
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true
      setIsPolling(true)

      try {
        // Preparar datos para búsqueda en ESPN
        const matchesToFind = (await Promise.all(pendingEntries.map(async entry => {
          const [home, away] = entry.match.split(' vs ')
          
          // Intentar obtener sportKey: primero del entry, luego detectarlo de la liga
          let sportKey = entry.sportKey
          if (!sportKey && entry.league) {
            sportKey = detectSportKey(entry.league)
            if (sportKey) {
              console.info(`[Match Results] "${entry.match}": sportKey detectado "${sportKey}" desde liga "${entry.league}"`)
            }
          }
          
          let matchId = entry.matchId
          // Las apuestas guardadas antes de conservar el ID se recuperan por
          // equipos y fecha. El ID resuelto queda persistido para los próximos polls.
          if (!Number.isFinite(Number(matchId))) {
            matchId = await findMatchIdByTeams(home?.trim(), away?.trim(), entry.date)
            if (matchId != null) {
              onMetadataResolved?.(entry.id, { matchId, sportKey })
              console.info(`[Match Results] ID Sofascore recuperado para "${entry.match}": ${matchId}`)
            }
          }

          return {
            homeTeam: home?.trim() || '',
            awayTeam: away?.trim() || '',
            date: entry.date,
            matchId,
            // No se consulta otra liga como fallback: sería un falso negativo.
            sportKey,
            entryId: entry.id,
            league: entry.league,
          }
        }))).filter(m => m.homeTeam && m.awayTeam && m.date)

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

        // Sofascore cubre también ligas que ESPN no publica, como K League 1.
        // Las entradas guardadas desde Sofascore ya incluyen su ID de evento.
        const sofascoreIds = matchesToFind
          .map(m => Number(m.matchId))
          .filter(Number.isFinite)
        const sofascoreResults = sofascoreIds.length
          ? await fetchMultipleResults(sofascoreIds)
          : new Map()

        // ESPN es el respaldo para entradas sin resultado disponible en Sofascore.
        const espnMatches = matchesToFind.filter(m => !sofascoreResults.has(Number(m.matchId)))
        const espnResults = espnMatches.length
          ? await findMultipleResults(espnMatches)
          : new Map()

        if (sofascoreResults.size > 0 || espnResults.size > 0) {
          console.info(`[Match Results] ${sofascoreResults.size + espnResults.size} partidos finalizados`)

          // Actualizar cada entrada que tenga resultado
          for (const matchData of matchesToFind) {
            const key = `${matchData.homeTeam}|${matchData.awayTeam}`
            const result = sofascoreResults.get(Number(matchData.matchId)) ?? espnResults.get(key)

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
        pollInFlightRef.current = false
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
  }, [pendingEntries, onResultUpdate, onMetadataResolved])

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
