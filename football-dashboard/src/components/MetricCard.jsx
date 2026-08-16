/**
 * Tarjeta de métrica individual para el dashboard de rentabilidad.
 */
export default function MetricCard({ icon, label, value, sub, color = 'white', size = 'md' }) {
  const valueSize = size === 'lg' ? 'text-3xl' : 'text-2xl'
  const colors = {
    green:  'text-accent-green',
    red:    'text-accent-red',
    yellow: 'text-accent-yellow',
    blue:   'text-accent-blue',
    white:  'text-white',
  }

  return (
    <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-pitch-600 text-xs font-medium uppercase tracking-wider">
        <span className="text-base">{icon}</span>
        {label}
      </div>
      <div className={`${valueSize} font-extrabold tabular-nums ${colors[color]}`}>
        {value}
      </div>
      {sub && (
        <div className="text-pitch-600 text-xs">{sub}</div>
      )}
    </div>
  )
}
