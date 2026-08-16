import { useState, useMemo } from 'react'
import EvBadge from './EvBadge.jsx'
import ProbabilityBar from './ProbabilityBar.jsx'

const SORT_KEYS = {
  ev:            'Índice EV',
  bookmakerOdds: 'Cuota',
  aiProbability: 'Prob. IA',
}

const LEAGUE_FLAGS = {
  'La Liga':           '🇪🇸',
  'Premier League':    '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Bundesliga':        '🇩🇪',
  'Ligue 1':           '🇫🇷',
  'Serie A':           '🇮🇹',
  'Champions League':  '🏆',
  'Eredivisie':        '🇳🇱',
  'Liga Portugal':     '🇵🇹',
  'Super Lig':         '🇹🇷',
  'MLS':               '🇺🇸',
  'Brasileirao':       '🇧🇷',
  'Liga MX':           '🇲🇽',
  'Primera Division':  '🇦🇷',
}

/** Renderiza cada letra de la racha (W/D/L) con su color */
function FormBadge({ form }) {
  if (!form) return <span className="text-pitch-700 text-xs">N/D</span>
  return (
    <div className="flex gap-0.5">
      {form.split('').slice(-5).map((c, i) => {
        const color =
          c === 'W' ? 'bg-accent-green text-pitch-950' :
          c === 'D' ? 'bg-accent-yellow text-pitch-950' :
          c === 'L' ? 'bg-accent-red text-white' :
          'bg-pitch-700 text-pitch-600'
        return (
          <span key={i} className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${color}`}>
            {c === 'W' ? 'G' : c === 'L' ? 'P' : c}
          </span>
        )
      })}
    </div>
  )
}

function leagueFlag(league) {
  for (const [key, flag] of Object.entries(LEAGUE_FLAGS)) {
    if (league?.includes(key)) return flag
  }
  return '⚽'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export default function MatchTable({ opportunities, onSave }) {
  const [sortKey, setSortKey]         = useState('ev')
  const [sortDir, setSortDir]         = useState('desc')
  const [filterMin, setFilterMin]     = useState(-Infinity)
  const [expandedRow, setExpandedRow] = useState(null)
  const [savedIds, setSavedIds]       = useState(new Set())

  const sorted = useMemo(() => {
    return [...opportunities]
      .filter(o => o.ev >= filterMin)
      .sort((a, b) => {
        const mul = sortDir === 'desc' ? -1 : 1
        return mul * (a[sortKey] - b[sortKey])
      })
  }, [opportunities, sortKey, sortDir, filterMin])

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span className="text-pitch-700 ml-1">↕</span>
    return <span className="text-accent-green ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const valueCount  = opportunities.filter(o => o.ev >= 5).length
  const weakCount   = opportunities.filter(o => o.ev >= 0 && o.ev < 5).length

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/20 rounded-lg px-3 py-1.5">
          <span className="text-accent-green text-lg">✅</span>
          <span className="text-accent-green font-bold text-sm">{valueCount}</span>
          <span className="text-pitch-600 text-xs">Valor fuerte (EV ≥ 5%)</span>
        </div>
        <div className="flex items-center gap-2 bg-accent-yellow/10 border border-accent-yellow/20 rounded-lg px-3 py-1.5">
          <span className="text-accent-yellow text-lg">⚠️</span>
          <span className="text-accent-yellow font-bold text-sm">{weakCount}</span>
          <span className="text-pitch-600 text-xs">Valor débil (EV 0–5%)</span>
        </div>
        <div className="flex items-center gap-2 bg-pitch-800 border border-pitch-700 rounded-lg px-3 py-1.5">
          <span className="text-white text-lg">📊</span>
          <span className="text-white font-bold text-sm">{sorted.length}</span>
          <span className="text-pitch-600 text-xs">Total mostrados</span>
        </div>

        {/* Filtro rápido */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-pitch-600 text-xs">Filtrar EV ≥</span>
          <div className="flex gap-1">
            {[[-Infinity, 'Todos'], [0, 'EV+'], [5, 'Fuerte']].map(([val, label]) => (
              <button
                key={label}
                onClick={() => setFilterMin(val)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  filterMin === val
                    ? 'bg-accent-blue text-white'
                    : 'bg-pitch-800 text-pitch-600 hover:text-white hover:bg-pitch-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-pitch-700">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-pitch-800 border-b border-pitch-700">
              <th className="table-cell-base text-pitch-600 font-medium text-xs uppercase tracking-widest w-6">#</th>
              <th className="table-cell-base text-pitch-600 font-medium text-xs uppercase tracking-widest">Partido</th>
              <th className="table-cell-base text-pitch-600 font-medium text-xs uppercase tracking-widest">Liga / Fecha</th>
              <th className="table-cell-base text-pitch-600 font-medium text-xs uppercase tracking-widest">Mercado</th>
              <th
                className="table-cell-base text-pitch-600 font-medium text-xs uppercase tracking-widest cursor-pointer hover:text-white select-none"
                onClick={() => handleSort('bookmakerOdds')}
              >
                Cuota <SortIcon col="bookmakerOdds" />
              </th>
              <th
                className="table-cell-base text-pitch-600 font-medium text-xs uppercase tracking-widest cursor-pointer hover:text-white select-none"
                onClick={() => handleSort('aiProbability')}
              >
                Prob. IA <SortIcon col="aiProbability" />
              </th>
              <th
                className="table-cell-base text-pitch-600 font-medium text-xs uppercase tracking-widest cursor-pointer hover:text-white select-none"
                onClick={() => handleSort('ev')}
              >
                EV+ <SortIcon col="ev" />
              </th>
              <th className="table-cell-base text-pitch-600 font-medium text-xs uppercase tracking-widest">Forma</th>
              <th className="table-cell-base text-pitch-600 font-medium text-xs uppercase tracking-widest">Justificación IA</th>
              <th className="table-cell-base text-pitch-600 font-medium text-xs uppercase tracking-widest w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((opp, idx) => {
              const rowKey    = `${opp.matchId ?? opp.id}-${opp.market}-${opp.selection}`
              const isExpanded = expandedRow === idx
              const rowBg = opp.ev >= 5
                ? 'bg-accent-green/5 hover:bg-accent-green/10'
                : opp.ev >= 0
                ? 'hover:bg-pitch-800/60'
                : 'opacity-60 hover:bg-pitch-800/40'

              return (
                <tr
                  key={rowKey}
                  className={`border-b border-pitch-800 transition-colors cursor-pointer ${rowBg}`}
                  onClick={() => setExpandedRow(isExpanded ? null : idx)}
                >
                  <td className="table-cell-base text-pitch-600 text-xs">{idx + 1}</td>

                  {/* Partido */}
                  <td className="table-cell-base">
                    <div className="font-semibold text-white text-sm leading-tight">
                      {opp.match || `${opp.home} vs ${opp.away}`}
                    </div>
                    <div className="text-pitch-600 text-xs mt-0.5">{opp.time}</div>
                  </td>

                  {/* Liga / Fecha */}
                  <td className="table-cell-base">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{leagueFlag(opp.league)}</span>
                      <div>
                        <div className="text-white text-xs font-medium">{opp.league}</div>
                        <div className="text-pitch-600 text-xs">{formatDate(opp.date)}</div>
                      </div>
                    </div>
                  </td>

                  {/* Mercado */}
                  <td className="table-cell-base">
                    <div className="text-accent-blue text-xs font-medium">{opp.market}</div>
                    <div className="text-white text-sm font-semibold mt-0.5">{opp.selection}</div>
                  </td>

                  {/* Cuota */}
                  <td className="table-cell-base">
                    <span className="text-accent-yellow font-bold text-base tabular-nums">
                      {parseFloat(opp.bookmakerOdds).toFixed(2)}
                    </span>
                  </td>

                  {/* Prob IA */}
                  <td className="table-cell-base">
                    <ProbabilityBar value={opp.aiProbability} />
                  </td>

                  {/* EV */}
                  <td className="table-cell-base">
                    <EvBadge ev={opp.ev} />
                  </td>

                  {/* Forma */}
                  <td className="table-cell-base">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-pitch-600 text-xs w-3">L</span>
                        <FormBadge form={opp.homeForm} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-pitch-600 text-xs w-3">V</span>
                        <FormBadge form={opp.awayForm} />
                      </div>
                    </div>
                  </td>

                  {/* Justificación */}
                  <td className="table-cell-base max-w-xs">
                    <p
                      className={`text-xs text-pitch-600 leading-relaxed transition-all ${
                        isExpanded ? '' : 'line-clamp-2'
                      }`}
                    >
                      {opp.justification}
                    </p>
                    {opp.justification?.length > 80 && (
                      <span className="text-accent-blue text-xs mt-0.5 block">
                        {isExpanded ? '▲ menos' : '▼ más'}
                      </span>
                    )}
                  </td>

                  {/* Guardar en historial */}
                  <td className="table-cell-base" onClick={e => e.stopPropagation()}>
                    {savedIds.has(rowKey) ? (
                      <span className="text-accent-green text-xs font-medium whitespace-nowrap">✓ Guardado</span>
                    ) : (
                      <button
                        onClick={() => {
                          const ok = onSave?.(opp)
                          if (ok !== false) setSavedIds(s => new Set([...s, rowKey]))
                        }}
                        className="text-xs bg-pitch-800 border border-pitch-700 text-pitch-600
                                   hover:bg-accent-green/10 hover:border-accent-green/40 hover:text-accent-green
                                   px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
                      >
                        + Historial
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-pitch-600">
                  No hay oportunidades con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
