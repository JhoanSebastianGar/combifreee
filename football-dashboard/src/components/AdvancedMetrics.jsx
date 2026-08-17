/**
 * AdvancedMetrics.jsx
 * Componente para mostrar métricas avanzadas de backtesting:
 * - Win Rate por liga
 * - Win Rate por mercado
 * - Win Rate por rango de cuotas
 * - Win Rate por rango de EV
 * - Racha actual
 * - Drawdown máximo
 */

export default function AdvancedMetrics({ metrics }) {
  const { byLeague, byMarket, byOddsRange, byEVRange, streak, maxDrawdown } = metrics

  if (!byLeague && !byMarket) return null

  return (
    <div className="space-y-6">
      
      {/* ── Racha y Drawdown ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Racha actual */}
        <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{streak?.type === 'winning' ? '🔥' : '❄️'}</span>
            <h3 className="text-white font-bold text-sm">Racha Actual</h3>
          </div>
          
          {streak?.count > 0 ? (
            <div>
              <p className={`text-3xl font-bold ${
                streak.type === 'winning' ? 'text-accent-green' : 'text-accent-red'
              }`}>
                {streak.count}
              </p>
              <p className="text-pitch-600 text-sm mt-1">
                {streak.type === 'winning' ? 'victorias' : 'derrotas'} consecutivas
              </p>
            </div>
          ) : (
            <p className="text-pitch-600 text-sm">Sin datos suficientes</p>
          )}
        </div>

        {/* Drawdown máximo */}
        <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📉</span>
            <h3 className="text-white font-bold text-sm">Drawdown Máximo</h3>
          </div>
          
          <div>
            <p className="text-3xl font-bold text-accent-red">
              -{maxDrawdown}u
            </p>
            <p className="text-pitch-600 text-sm mt-1">
              Peor racha de pérdidas acumuladas
            </p>
          </div>
        </div>
      </div>

      {/* ── Performance por Liga ── */}
      {byLeague?.length > 0 && (
        <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-4">
          <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <span>🏆</span> Performance por Liga
          </h3>
          
          <div className="space-y-2">
            {byLeague
              .sort((a, b) => b.pl - a.pl)
              .map(({ key, total, won, lost, pl, yield: yld, winRate }) => (
                <div 
                  key={key}
                  className="flex items-center justify-between p-2 bg-pitch-800/50 rounded-lg hover:bg-pitch-800 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{key}</p>
                    <p className="text-pitch-600 text-xs">
                      {won}G · {lost}P de {total}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className={`text-sm font-bold ${pl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {pl >= 0 ? '+' : ''}{pl.toFixed(2)}u
                      </p>
                      <p className="text-pitch-600 text-xs">
                        Yield {yld.toFixed(1)}%
                      </p>
                    </div>
                    
                    <div className="w-16 text-right">
                      <p className={`text-sm font-bold ${
                        winRate >= 55 ? 'text-accent-green' : 
                        winRate >= 45 ? 'text-accent-yellow' : 
                        'text-accent-red'
                      }`}>
                        {winRate.toFixed(0)}%
                      </p>
                      <p className="text-pitch-600 text-xs">WR</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Performance por Mercado ── */}
      {byMarket?.length > 0 && (
        <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-4">
          <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <span>📊</span> Performance por Mercado
          </h3>
          
          <div className="space-y-2">
            {byMarket
              .sort((a, b) => b.pl - a.pl)
              .map(({ key, total, won, lost, pl, yield: yld, winRate }) => (
                <div 
                  key={key}
                  className="flex items-center justify-between p-2 bg-pitch-800/50 rounded-lg hover:bg-pitch-800 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{key}</p>
                    <p className="text-pitch-600 text-xs">
                      {won}G · {lost}P de {total}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className={`text-sm font-bold ${pl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {pl >= 0 ? '+' : ''}{pl.toFixed(2)}u
                      </p>
                      <p className="text-pitch-600 text-xs">
                        Yield {yld.toFixed(1)}%
                      </p>
                    </div>
                    
                    <div className="w-16 text-right">
                      <p className={`text-sm font-bold ${
                        winRate >= 55 ? 'text-accent-green' : 
                        winRate >= 45 ? 'text-accent-yellow' : 
                        'text-accent-red'
                      }`}>
                        {winRate.toFixed(0)}%
                      </p>
                      <p className="text-pitch-600 text-xs">WR</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Performance por Rango de Cuotas ── */}
      {byOddsRange?.length > 0 && (
        <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-4">
          <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <span>💰</span> Performance por Rango de Cuotas
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {byOddsRange
              .sort((a, b) => {
                const order = ['<1.5', '1.5-2.0', '2.0-3.0', '3.0-5.0', '>5.0']
                return order.indexOf(a.key) - order.indexOf(b.key)
              })
              .map(({ key, total, won, lost, pl, winRate }) => (
                <div 
                  key={key}
                  className="p-3 bg-pitch-800/50 rounded-lg border border-pitch-700"
                >
                  <p className="text-accent-yellow text-xs font-bold mb-1">{key}</p>
                  <p className={`text-lg font-bold ${pl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {pl >= 0 ? '+' : ''}{pl.toFixed(1)}u
                  </p>
                  <p className="text-pitch-600 text-xs mt-1">
                    WR {winRate.toFixed(0)}% · {won}G {lost}P
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Performance por Rango de EV ── */}
      {byEVRange?.length > 0 && (
        <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-4">
          <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <span>⚡</span> Performance por Rango de EV
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {byEVRange
              .sort((a, b) => {
                const order = ['<0%', '0-5%', '5-10%', '10-20%', '>20%']
                return order.indexOf(a.key) - order.indexOf(b.key)
              })
              .map(({ key, total, won, lost, pl, winRate }) => (
                <div 
                  key={key}
                  className="p-3 bg-pitch-800/50 rounded-lg border border-pitch-700"
                >
                  <p className="text-accent-blue text-xs font-bold mb-1">EV {key}</p>
                  <p className={`text-lg font-bold ${pl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {pl >= 0 ? '+' : ''}{pl.toFixed(1)}u
                  </p>
                  <p className="text-pitch-600 text-xs mt-1">
                    WR {winRate.toFixed(0)}% · {won}G {lost}P
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
