import { useState, useCallback } from 'react'
import { loadMatchesForDate } from './services/sofascoreService.js'
import { analyzeMatches }     from './services/groqService.js'
import { useHistorial }       from './hooks/useHistorial.js'
import { useMatchResults }    from './hooks/useMatchResults.js'
import MatchTable             from './components/MatchTable.jsx'
import HistorialView          from './components/HistorialView.jsx'
import Spinner                from './components/Spinner.jsx'
import ApiKeyInput            from './components/ApiKeyInput.jsx'

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

const SOURCE_META = {
  sofascore:  { label: 'Cuotas reales · Sofascore',              dot: 'bg-accent-blue',   text: 'text-accent-blue'   },
  'odds-api': { label: 'Cuotas reales · Odds API + Forma ESPN',  dot: 'bg-accent-green',  text: 'text-accent-green'  },
  mock:       { label: 'Datos simulados (fallback)',              dot: 'bg-accent-yellow', text: 'text-accent-yellow' },
}

const INIT = {
  phase:       'idle',
  loadedCount: 0,
  totalCount:  0,
  rawMatches:  [],
  opps:        [],
  source:      null,
  error:       null,
  lastUpdated: null,
}

// Groq devuelve el análisis, pero el ID y la liga deben proceder siempre de la
// fuente de datos original. Así el historial puede volver a consultar el mismo
// evento cuando finalice, sin depender de que la IA repita esos campos.
function attachMatchMetadata(opportunities, rawMatches) {
  const byId = new Map(rawMatches.map(match => [String(match.id), match]))
  const normalize = (value = '') => value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const byTeams = new Map(rawMatches.map(match => [
    `${normalize(match.home)}|${normalize(match.away)}`,
    match,
  ]))

  return opportunities.map(opportunity => {
    const [home = '', away = ''] = (opportunity.match ?? '').split(' vs ')
    const sourceMatch = byId.get(String(opportunity.matchId)) ??
      byTeams.get(`${normalize(home)}|${normalize(away)}`)

    if (!sourceMatch) return opportunity

    return {
      ...opportunity,
      matchId: sourceMatch.id,
      sportKey: sourceMatch.sportKey,
      league: sourceMatch.league,
      date: sourceMatch.date,
      time: sourceMatch.time,
      match: `${sourceMatch.home} vs ${sourceMatch.away}`,
    }
  })
}

// ─── componente ──────────────────────────────────────────────────────────────

export default function App() {
  const [tab,              setTab]              = useState('pronosticos')   // 'pronosticos' | 'historial'
  const [groqKey,          setGroqKey]          = useState(import.meta.env.VITE_GROQ_API_KEY        ?? '')
  const [oddsApiKey,       setOddsApiKey]       = useState(import.meta.env.VITE_ODDS_API_KEY        ?? '')
  const [apiFootballKey,   setApiFootballKey]   = useState(import.meta.env.VITE_APIFOOTBALL_API_KEY ?? '')
  const [date,             setDate]             = useState(todayISO())
  const [analysis,         setAnalysis]         = useState(INIT)

  const { entries, metrics, addEntry, updateStatus, updateStake, updateEntryMetadata, removeEntry, clearAll } = useHistorial()

  // Polling automático de resultados para partidos pendientes
  const pendingEntries = entries.filter(e => e.status === 'Pendiente')
  
  const handleResultUpdate = useCallback((entryId, resultData) => {
    // Auto-actualizar el estado según el resultado
    if (resultData.won === true) {
      updateStatus(entryId, 'Ganada')
      console.info(`[Auto-Update] ✅ ${entryId} → Ganada (${resultData.homeScore}-${resultData.awayScore})`)
    } else if (resultData.won === false) {
      updateStatus(entryId, 'Perdida')
      console.info(`[Auto-Update] ❌ ${entryId} → Perdida (${resultData.homeScore}-${resultData.awayScore})`)
    }
  }, [updateStatus])
  
  const { isPolling, lastUpdate } = useMatchResults(
    pendingEntries,
    handleResultUpdate,
    updateEntryMetadata,
  )

  const isLoading = analysis.phase === 'sofascore' || analysis.phase === 'groq'

  // ── pipeline ──────────────────────────────────────────────────────────────
  const sendPredictionsToServer = useCallback(async (opportunities) => {
    try {
      if (!opportunities || !opportunities.length) return
      const payload = {
        generatedAt: new Date().toISOString(),
        opportunities: opportunities.map(o => ({
          date: o.date ?? o.date ?? '',
          home: o.home ?? (o.match ? String(o.match).split(' vs ')[0] : ''),
          away: o.away ?? (o.match ? String(o.match).split(' vs ')[1] : ''),
          fixture_id: o.matchId ?? o.id ?? '',
          market: o.market ?? '',
          selection: o.selection ?? '',
          probabilidad_estimada: o.aiProbability ?? o.aiProbability ?? o.probability ?? '',
          cuota_real: o.bookmakerOdds ?? o.bookmakerOdds ?? o.odds ?? '',
          ev_calculado: typeof o.ev !== 'undefined' ? o.ev : (
            (Number(o.aiProbability) ? (Number(o.aiProbability) / 100.0) * Number(o.bookmakerOdds) * 100.0 - 100.0 : '')
          )
        }))
      }

      // No bloquear la UI si el servidor no responde
      fetch('http://localhost:3001/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(err => console.warn('No se pudo enviar predicciones al servidor:', err))
    } catch (err) {
      console.warn('Error preparando predicciones para enviar:', err)
    }
  }, [])

  const handleAnalyze = useCallback(async () => {
    setAnalysis({ ...INIT, phase: 'sofascore' })
    try {
      const { matches: rawMatches, source } = await loadMatchesForDate(date, {
        limit:            20,
        oddsApiKey,
        apiFootballKey,
        onProgress: (loaded, total) =>
          setAnalysis(s => ({ ...s, loadedCount: loaded, totalCount: total })),
      })
      setAnalysis(s => ({ ...s, phase: 'groq', rawMatches, source }))

      const analyzedOpps = await analyzeMatches(groqKey, rawMatches)
      const opps = attachMatchMetadata(analyzedOpps, rawMatches)

      // Enviar las predicciones al servidor de almacenamiento (no bloqueante)
      sendPredictionsToServer(opps)

      setAnalysis(s => ({ ...s, phase: 'done', opps, lastUpdated: new Date() }))
    } catch (err) {
      setAnalysis(s => ({ ...s, phase: 'error', error: err.message }))
    }
  }, [groqKey, oddsApiKey, apiFootballKey, date, sendPredictionsToServer])

  const { phase, loadedCount, totalCount, rawMatches, opps, source, error, lastUpdated } = analysis
  const srcMeta = SOURCE_META[source] ?? SOURCE_META.mock

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-pitch-950 flex flex-col">

      {/* ── Header ── */}
      <header className="border-b border-pitch-800 bg-pitch-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-green/10 border border-accent-green/30 flex items-center justify-center text-xl">
              ⚽
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none tracking-tight">
                Football Value Finder
              </h1>
              <p className="text-pitch-600 text-xs mt-0.5">
                Sofascore · Odds API · ESPN · Groq GPT-OSS-120B
              </p>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 bg-pitch-800 rounded-xl p-1">
            <TabBtn
              active={tab === 'pronosticos'}
              onClick={() => setTab('pronosticos')}
              icon="🔍"
              label="Pronósticos"
            />
            <TabBtn
              active={tab === 'historial'}
              onClick={() => setTab('historial')}
              icon="📈"
              label="Historial & Rentabilidad"
            />
          </nav>

          {/* Pipeline status */}
          {tab === 'pronosticos' && (
            <div className="flex items-center gap-2 text-xs">
              <PhaseBadge label="Datos"   active={phase === 'sofascore'} done={['groq','done'].includes(phase)} />
              <span className="text-pitch-700">→</span>
              <PhaseBadge label="Groq IA" active={phase === 'groq'}      done={phase === 'done'} />
              <span className="text-pitch-700">→</span>
              <PhaseBadge label="EV+"     done={phase === 'done'} />
              {lastUpdated && (
                <span className="text-pitch-700 hidden sm:block ml-2">
                  {lastUpdated.toLocaleTimeString('es-ES')}
                </span>
              )}
            </div>
          )}

          {/* Métricas rápidas en el header cuando está en historial */}
          {tab === 'historial' && entries.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className={`font-bold ${metrics.pl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                P/L {metrics.pl >= 0 ? '+' : ''}{metrics.pl.toFixed(2)}u
              </span>
              <span className="text-pitch-600">·</span>
              <span className="text-pitch-600">Yield {metrics.yield.toFixed(1)}%</span>
              <span className="text-pitch-600">·</span>
              <span className="text-pitch-600">{metrics.won}G {metrics.lost}P</span>
              

            </div>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-8">

        {/* ═══════════════ PESTAÑA PRONÓSTICOS ═══════════════ */}
        {tab === 'pronosticos' && (
          <div className="space-y-8">

            {/* Hero card */}
            <section className="relative rounded-2xl overflow-hidden bg-pitch-900 border border-pitch-700 p-6 sm:p-8">
              <GridBg />
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end gap-6">

                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 bg-accent-blue/10 border border-accent-blue/20 rounded-full px-3 py-1 mb-3">
                    <span className="w-2 h-2 rounded-full bg-accent-blue" />
                    <span className="text-accent-blue text-xs font-bold uppercase tracking-widest">
                      Sofascore → Odds API → ESPN → IA
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                    Value betting con <span className="text-accent-green">cuotas reales</span>
                  </h2>
                  <p className="text-pitch-600 mt-2 text-sm max-w-lg">
                    Datos en vivo de Sofascore o Odds API, forma de ESPN, análisis de IA.
                    Guarda las apuestas en tu historial con un clic.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
                    <StepPill n="1" text="Sofascore / Odds API" color="blue" />
                    <Arrow />
                    <StepPill n="2" text="Forma ESPN" color="blue" />
                    <Arrow />
                    <StepPill n="3" text="Groq IA (EV+)" color="green" />
                  </div>

                  {rawMatches.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {rawMatches.map(m => (
                        <span key={m.id} className="text-xs bg-pitch-800 border border-pitch-700 rounded px-2 py-0.5 text-pitch-600">
                          {m.home} <span className="text-pitch-700">vs</span> {m.away}
                          {m.odds && <span className="ml-1 text-accent-yellow font-mono">{m.odds.homeOdds}</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Controles */}
                <div className="flex flex-col gap-3 w-full sm:w-72">
                  <div>
                    <label className="text-xs text-pitch-600 font-medium uppercase tracking-wider block mb-1">Fecha</label>
                    <input
                      type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isLoading}
                      className="w-full bg-pitch-800 border border-pitch-700 rounded-lg px-3 py-2 text-sm text-white
                                 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/40
                                 transition-colors disabled:opacity-50 [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-pitch-600 font-medium uppercase tracking-wider block mb-1">Groq API Key</label>
                    <ApiKeyInput value={groqKey} onChange={setGroqKey} />
                  </div>
                  <div>
                    <label className="text-xs text-pitch-600 font-medium uppercase tracking-wider block mb-1">
                      The Odds API Key <span className="text-pitch-700 normal-case font-normal">(fallback)</span>
                    </label>
                    <ApiKeyInput value={oddsApiKey} onChange={setOddsApiKey} />
                  </div>
                  <button
                    onClick={handleAnalyze} disabled={isLoading}
                    className={`flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm
                                tracking-wide transition-all duration-200
                                ${isLoading
                                  ? 'bg-pitch-800 text-pitch-600 cursor-not-allowed border border-pitch-700'
                                  : 'bg-accent-green text-pitch-950 hover:brightness-110 active:scale-95 glow-green'}`}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        {phase === 'sofascore' ? 'Cargando partidos...' : 'Analizando con IA...'}
                      </>
                    ) : (
                      <><span>🔍</span> Analizar Oportunidades de Valor</>
                    )}
                  </button>
                  {phase === 'done' && (
                    <button onClick={handleAnalyze} className="text-xs text-accent-blue hover:text-white transition-colors text-center">
                      🔄 Reanálisis con datos frescos
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Error */}
            {phase === 'error' && (
              <div className="flex items-start gap-3 bg-accent-red/10 border border-accent-red/30 rounded-xl p-4">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-accent-red font-semibold text-sm">Error en el análisis</p>
                  <p className="text-accent-red/70 text-xs mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Spinner */}
            {isLoading && <Spinner phase={phase} loaded={loadedCount} total={totalCount} />}

            {/* Banners de fuente */}
            {phase === 'done' && source === 'odds-api' && (
              <div className="flex items-start gap-3 bg-accent-green/10 border border-accent-green/25 rounded-xl px-4 py-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-accent-green font-semibold text-sm">Cuotas reales · The Odds API + Forma ESPN</p>
                  <p className="text-accent-green/70 text-xs mt-0.5">
                    Sofascore no disponible. Cuotas de Pinnacle/Bet365 · Forma pre-partido de ESPN.
                  </p>
                </div>
              </div>
            )}
            {phase === 'done' && source === 'mock' && (
              <div className="flex items-start gap-3 bg-accent-yellow/10 border border-accent-yellow/25 rounded-xl px-4 py-3">
                <span className="text-xl">🔌</span>
                <div>
                  <p className="text-accent-yellow font-semibold text-sm">Modo simulado activo</p>
                  <p className="text-accent-yellow/70 text-xs mt-0.5">
                    Ninguna fuente en vivo estuvo disponible. Datos de ejemplo.
                  </p>
                </div>
              </div>
            )}

            {/* Resultados */}
            {phase === 'done' && opps.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-white font-bold text-lg">
                    Oportunidades detectadas
                    <span className="ml-2 text-sm font-normal text-pitch-600">
                      {opps.length} mercados · {rawMatches.length} partidos
                    </span>
                  </h3>
                  <div className={`flex items-center gap-2 text-xs ${srcMeta.text}`}>
                    <span className={`w-2 h-2 rounded-full inline-block ${srcMeta.dot}`} />
                    {srcMeta.label}
                  </div>
                </div>
                <MatchTable
                  opportunities={opps}
                  onSave={(opp) => {
                    const ok = addEntry(opp)
                    return ok  // false si ya existía
                  }}
                />
              </section>
            )}

            {phase === 'done' && opps.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="text-5xl">🤔</div>
                <p className="text-white font-semibold">El mercado está bien calibrado hoy</p>
                <p className="text-pitch-600 text-sm max-w-xs">
                  La IA no encontró EV+ en los {rawMatches.length} partidos. Prueba con otra fecha.
                </p>
              </div>
            )}

            {phase === 'idle' && (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="text-6xl">📡</div>
                <h3 className="text-white font-bold text-xl">Listo para analizar</h3>
                <p className="text-pitch-600 text-sm max-w-sm">
                  Selecciona una fecha, añade tu API Key de Groq y pulsa el botón.
                  Guarda los pronósticos que te interesen en el Historial.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ PESTAÑA HISTORIAL ═══════════════ */}
        {tab === 'historial' && (
          <HistorialView
            entries={entries}
            metrics={metrics}
            onUpdateStatus={updateStatus}
            onUpdateStake={updateStake}
            onRemove={removeEntry}
            onClearAll={clearAll}
            isPolling={isPolling}
            pendingCount={pendingEntries.length}
            lastUpdate={lastUpdate}
          />
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-pitch-800 py-4 text-center">
        <p className="text-pitch-600 text-xs">
          Football Value Finder · Sofascore · The Odds API · ESPN · Groq ·
          Solo informativo — apuesta con responsabilidad
        </p>
      </footer>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative ${
        active
          ? 'bg-pitch-700 text-white'
          : 'text-pitch-600 hover:text-white hover:bg-pitch-700/50'
      }`}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {badge != null && (
        <span className="bg-accent-green text-pitch-950 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

function PhaseBadge({ label, active = false, done = false }) {
  return (
    <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 border transition-colors
      ${active ? 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue' :
        done   ? 'bg-accent-green/10 border-accent-green/30 text-accent-green' :
                 'bg-pitch-800 border-pitch-700 text-pitch-600'}`}
    >
      {active && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />}
      {done   && <span>✓</span>}
      {label}
    </div>
  )
}

function StepPill({ n, text, color }) {
  const cls = {
    blue:  'bg-accent-blue/10 border-accent-blue/20 text-accent-blue',
    green: 'bg-accent-green/10 border-accent-green/20 text-accent-green',
  }
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-1 ${cls[color]}`}>
      <span className="font-bold">{n}.</span> {text}
    </span>
  )
}

function Arrow() { return <span className="text-pitch-700">→</span> }

function GridBg() {
  return (
    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
      backgroundImage: `
        repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(255,255,255,0.05) 40px,rgba(255,255,255,0.05) 41px),
        repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,0.05) 40px,rgba(255,255,255,0.05) 41px)
      `,
    }} />
  )
}
