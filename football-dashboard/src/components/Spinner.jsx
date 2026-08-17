/**
 * Spinner con progreso en dos fases:
 *  Fase 1 — cargando datos (Sofascore / Odds API + ESPN)
 *  Fase 2 — IA analizando
 */
export default function Spinner({ phase = 'sofascore', loaded = 0, total = 0 }) {
  const isData = phase === 'sofascore'
  const pct    = total > 0 ? Math.round((loaded / total) * 100) : 0
  const color  = isData ? '#448aff' : '#00e676'

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16">

      {/* Balón giratorio */}
      <div
        className="relative w-16 h-16 animate-spin"
        style={{ animationDuration: isData ? '1.8s' : '1.0s' }}
      >
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" stroke="#1a2d4a" strokeWidth="3" fill="#0b1422" />
          <polygon points="32,8 40,20 36,34 28,34 24,20" fill={color} opacity="0.9" />
          <polygon points="54,26 46,20 40,28 44,40 54,38" fill="#1e3560" stroke={color} strokeWidth="1" />
          <polygon points="10,26 18,20 24,28 20,40 10,38" fill="#1e3560" stroke={color} strokeWidth="1" />
          <polygon points="20,54 28,46 28,34 20,30 12,40" fill="#1e3560" stroke={color} strokeWidth="1" />
          <polygon points="44,54 36,46 36,34 44,30 52,40" fill="#1e3560" stroke={color} strokeWidth="1" />
          <polygon points="32,56 24,46 28,34 36,34 40,46" fill="#1e3560" stroke={color} strokeWidth="1" />
          <circle cx="32" cy="32" r="30" stroke={color} strokeWidth="2" fill="none" opacity="0.25" />
        </svg>
      </div>

      {/* Texto */}
      <div className="text-center space-y-1">
        {isData ? (
          <>
            <p className="text-accent-blue font-semibold text-base tracking-wide">
              Cargando partidos y cuotas...
            </p>
            <p className="text-pitch-600 text-sm">
              {total > 0
                ? `Partido ${loaded} de ${total} · Odds API + Forma ESPN`
                : 'Conectando con Sofascore / Odds API...'}
            </p>
          </>
        ) : (
          <>
            <p className="text-accent-green font-semibold text-base tracking-wide">
              IA analizando oportunidades de valor...
            </p>
            <p className="text-pitch-600 text-sm">
              GPT-OSS-120B · cuotas reales + forma ESPN
            </p>
          </>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="w-72 space-y-1.5">
        <div className="w-full h-2 bg-pitch-800 rounded-full overflow-hidden">
          {isData && total > 0 ? (
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #448aff, #00e676)' }}
            />
          ) : (
            <div
              className="h-full rounded-full"
              style={{
                width: '35%',
                background: isData
                  ? 'linear-gradient(90deg, #448aff, #00b0ff)'
                  : 'linear-gradient(90deg, #00e676, #448aff)',
                animation: 'indeterminate 1.4s ease-in-out infinite',
              }}
            />
          )}
        </div>

        {/* Pasos */}
        <div className="flex justify-between text-xs text-pitch-700">
          <span className={isData ? 'text-accent-blue' : 'text-accent-green'}>
            1. Cuotas
          </span>
          <span className={isData ? 'text-accent-blue' : 'text-accent-green'}>
            2. Forma ESPN
          </span>
          <span className={!isData ? 'text-accent-green' : ''}>
            3. Groq IA
          </span>
          <span>4. EV+</span>
        </div>
      </div>

      <style>{`
        @keyframes indeterminate {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(380%); }
        }
      `}</style>
    </div>
  )
}
