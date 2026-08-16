/**
 * Barra de probabilidad visual con color dinámico
 */
export default function ProbabilityBar({ value }) {
  const pct = Math.min(100, Math.max(0, value))

  const color =
    pct >= 65 ? '#00e676' :
    pct >= 45 ? '#448aff' :
    pct >= 30 ? '#ffd600' :
    '#ff1744'

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-pitch-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>
        {pct}%
      </span>
    </div>
  )
}
