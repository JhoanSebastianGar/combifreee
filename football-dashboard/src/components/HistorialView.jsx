import { useState } from 'react'
import MetricCard from './MetricCard.jsx'

const STATUS_OPTIONS = ['Pendiente', 'Ganada', 'Perdida', 'Anulada']

const STATUS_STYLE = {
  Pendiente: 'bg-pitch-800 text-pitch-600 border-pitch-700',
  Ganada:    'bg-accent-green/15 text-accent-green border-accent-green/30',
  Perdida:   'bg-accent-red/15 text-accent-red border-accent-red/30',
  Anulada:   'bg-pitch-700/40 text-pitch-600 border-pitch-700',
}

const STATUS_ICON = {
  Pendiente: '⏳',
  Ganada:    '✅',
  Perdida:   '❌',
  Anulada:   '🚫',
}

function plColor(val) {
  if (val > 0)  return 'green'
  if (val < 0)  return 'red'
  return 'white'
}

function formatPL(val) {
  const sign = val > 0 ? '+' : ''
  return `${sign}${val.toFixed(2)}u`
}

function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function entryTimestamp(entry) {
  const dateTime = `${entry.date ?? ''}T${entry.time || '00:00'}`
  const timestamp = new Date(dateTime).getTime()

  // Las entradas antiguas sin fecha se ordenan por el momento en que se guardaron.
  return Number.isNaN(timestamp) ? new Date(entry.savedAt ?? 0).getTime() : timestamp
}

// ─── Gráfico de barras simple (últimas 20 apuestas) ──────────────────────────

function PLChart({ entries }) {
  const resolved = entries
    .filter(e => e.status === 'Ganada' || e.status === 'Perdida')
    .slice(0, 20)
    .reverse()

  if (!resolved.length) return null

  // Calcular P/L acumulado
  let cum = 0
  const points = resolved.map(e => {
    if (e.status === 'Ganada')  cum += (e.odds - 1) * e.stake
    if (e.status === 'Perdida') cum -= e.stake
    return parseFloat(cum.toFixed(2))
  })

  const max    = Math.max(...points, 0.01)
  const min    = Math.min(...points, -0.01)
  const range  = max - min || 1
  const H      = 60   // px altura del chart
  const W_BAR  = 12
  const GAP    = 3

  const toY = (v) => H - ((v - min) / range) * H

  return (
    <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-4">
      <p className="text-pitch-600 text-xs font-medium uppercase tracking-wider mb-3">
        📈 P/L Acumulado (últimas {resolved.length} resueltas)
      </p>
      <svg
        width={resolved.length * (W_BAR + GAP)}
        height={H + 20}
        className="overflow-visible"
      >
        {/* Línea cero */}
        <line
          x1={0} y1={toY(0)}
          x2={resolved.length * (W_BAR + GAP)} y2={toY(0)}
          stroke="#1a2d4a" strokeWidth={1} strokeDasharray="4 2"
        />
        {/* Puntos conectados */}
        {points.map((p, i) => {
          const x  = i * (W_BAR + GAP) + W_BAR / 2
          const y  = toY(p)
          const prev = i > 0 ? points[i - 1] : p
          const px = (i - 1) * (W_BAR + GAP) + W_BAR / 2
          const py = toY(prev)
          return (
            <g key={i}>
              {i > 0 && (
                <line
                  x1={px} y1={py} x2={x} y2={y}
                  stroke={p >= 0 ? '#00e676' : '#ff1744'}
                  strokeWidth={1.5}
                />
              )}
              <circle
                cx={x} cy={y} r={3}
                fill={p >= 0 ? '#00e676' : '#ff1744'}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function HistorialView({ 
  entries, 
  metrics, 
  onUpdateStatus, 
  onUpdateStake, 
  onRemove, 
  onClearAll,
  isPolling = false,
  pendingCount = 0,
  lastUpdate = null,
}) {
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [confirmClear, setConfirmClear] = useState(false)
  const [dateOrder, setDateOrder] = useState('desc')

  const filtered = filterStatus === 'Todos'
    ? entries
    : entries.filter(e => e.status === filterStatus)

  const sortedEntries = [...filtered].sort((a, b) => {
    const difference = entryTimestamp(b) - entryTimestamp(a)
    return dateOrder === 'desc' ? difference : -difference
  })

  const { pl, yield: yld, winRate, total, won, lost, pending, voided, staked } = metrics

  return (
    <div className="space-y-6">



      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          icon="💰" label="Beneficio Total (P/L)"
          value={formatPL(pl)}
          sub={`${staked}u apostadas`}
          color={plColor(pl)}
          size="lg"
        />
        <MetricCard
          icon="📊" label="Yield"
          value={`${pl >= 0 ? '+' : ''}${yld.toFixed(1)}%`}
          sub="Rentabilidad sobre apostado"
          color={plColor(pl)}
        />
        <MetricCard
          icon="🎯" label="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          sub={`${won}G · ${lost}P de ${won + lost} resueltas`}
          color={winRate >= 50 ? 'green' : winRate > 0 ? 'yellow' : 'white'}
        />
        <MetricCard
          icon="📋" label="Total Apuestas"
          value={total}
          sub={`${pending} pendientes · ${voided} anuladas`}
          color="white"
        />
      </div>

      {/* ── Gráfico P/L ── */}
      <PLChart entries={entries} />

      {/* ── Tabla de historial ── */}
      <div className="space-y-3">

        {/* Barra de herramientas */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-pitch-600 text-xs">Filtrar:</span>
            <div className="flex gap-1">
              {['Todos', ...STATUS_OPTIONS].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                    filterStatus === s
                      ? 'bg-accent-blue text-white border-accent-blue'
                      : 'bg-pitch-800 text-pitch-600 border-pitch-700 hover:text-white'
                  }`}
                >
                  {s === 'Todos' ? `Todos (${total})` : `${STATUS_ICON[s]} ${s}`}
                </button>
              ))}
            </div>
          </div>

          {total > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-accent-red">¿Borrar todo?</span>
                <button
                  onClick={() => { onClearAll(); setConfirmClear(false) }}
                  className="text-xs bg-accent-red text-white px-2 py-1 rounded"
                >Confirmar</button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-xs text-pitch-600 hover:text-white"
                >Cancelar</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-xs text-pitch-700 hover:text-accent-red transition-colors"
              >
                🗑 Limpiar historial
              </button>
            )
          )}
        </div>

        {/* Tabla */}
        {sortedEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <span className="text-4xl">📭</span>
            <p className="text-white font-semibold">Sin apuestas guardadas</p>
            <p className="text-pitch-600 text-sm max-w-xs">
              Pulsa "Guardar en Historial" en cualquier pronóstico de la pestaña Pronósticos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-pitch-700">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-pitch-800 border-b border-pitch-700">
                  <th className="table-cell-base text-pitch-600 font-medium text-xs uppercase tracking-widest">
                    <button
                      type="button"
                      onClick={() => setDateOrder(order => order === 'desc' ? 'asc' : 'desc')}
                      className="inline-flex items-center gap-1 hover:text-white transition-colors"
                      title={dateOrder === 'desc' ? 'Ordenando de más reciente a más antigua' : 'Ordenando de más antigua a más reciente'}
                      aria-label="Cambiar el orden por fecha"
                    >
                      Fecha <span aria-hidden="true">{dateOrder === 'desc' ? '↓' : '↑'}</span>
                    </button>
                  </th>
                  {['Partido', 'Mercado / Selección', 'Cuota', 'Stake', 'P/L', 'Estado', ''].map(h => (
                    <th key={h} className="table-cell-base text-pitch-600 font-medium text-xs uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map(entry => {
                  const entryPL =
                    entry.status === 'Ganada'  ? (entry.odds - 1) * entry.stake :
                    entry.status === 'Perdida' ? -entry.stake :
                    null

                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-pitch-800 transition-colors ${
                        entry.status === 'Ganada'  ? 'bg-accent-green/5' :
                        entry.status === 'Perdida' ? 'bg-accent-red/5'   :
                        'hover:bg-pitch-800/40'
                      }`}
                    >
                      {/* Fecha */}
                      <td className="table-cell-base">
                        <div className="text-white text-xs">{formatDate(entry.date)}</div>
                        <div className="text-pitch-600 text-xs">{entry.time}</div>
                      </td>

                      {/* Partido */}
                      <td className="table-cell-base">
                        <div className="text-white text-sm font-semibold leading-tight max-w-[160px]">
                          {entry.match}
                        </div>
                        <div className="text-pitch-600 text-xs">{entry.league}</div>
                      </td>

                      {/* Mercado */}
                      <td className="table-cell-base">
                        <div className="text-accent-blue text-xs">{entry.market}</div>
                        <div className="text-white text-sm font-medium">{entry.selection}</div>
                      </td>

                      {/* Cuota */}
                      <td className="table-cell-base">
                        <span className="text-accent-yellow font-bold tabular-nums">
                          {entry.odds.toFixed(2)}
                        </span>
                        {entry.ev !== undefined && (
                          <div className="text-pitch-600 text-xs">EV {entry.ev > 0 ? '+' : ''}{entry.ev?.toFixed(1)}%</div>
                        )}
                      </td>

                      {/* Stake editable */}
                      <td className="table-cell-base">
                        <input
                          type="number"
                          min="0.01"
                          step="0.5"
                          value={entry.stake}
                          onChange={e => onUpdateStake(entry.id, e.target.value)}
                          className="w-16 bg-pitch-800 border border-pitch-700 rounded px-2 py-1 text-xs
                                     text-white text-center focus:outline-none focus:border-accent-blue
                                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="text-pitch-600 text-xs mt-0.5 text-center">unidades</div>
                      </td>

                      {/* P/L */}
                      <td className="table-cell-base">
                        {entryPL !== null ? (
                          <span className={`font-bold tabular-nums text-sm ${
                            entryPL > 0 ? 'text-accent-green' : 'text-accent-red'
                          }`}>
                            {entryPL > 0 ? '+' : ''}{entryPL.toFixed(2)}u
                          </span>
                        ) : (
                          <span className="text-pitch-700 text-xs">—</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="table-cell-base">
                        <div className="flex flex-wrap gap-1">
                          {STATUS_OPTIONS.map(s => (
                            <button
                              key={s}
                              onClick={() => onUpdateStatus(entry.id, s)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-colors font-medium ${
                                entry.status === s
                                  ? STATUS_STYLE[s]
                                  : 'bg-transparent border-pitch-800 text-pitch-700 hover:border-pitch-600 hover:text-pitch-500'
                              }`}
                            >
                              {s === entry.status && STATUS_ICON[s]} {s}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Eliminar */}
                      <td className="table-cell-base">
                        <button
                          onClick={() => onRemove(entry.id)}
                          className="text-pitch-700 hover:text-accent-red transition-colors text-sm"
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
