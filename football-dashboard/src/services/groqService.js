/**
 * groqService.js
 * Llama a Groq (openai/gpt-oss-120b) para analizar partidos enriquecidos
 * con datos reales de Sofascore (cuotas + forma pre-partido).
 */

import { formatMatchForPrompt } from './sofascoreService.js'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL        = 'openai/gpt-oss-120b'
export const MINIMUM_ODDS = 1.5

// ─── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
Eres un analista cuantitativo especializado en value betting de fútbol.
Recibes partidos con datos REALES de múltiples fuentes:
- Cuotas de casas de apuestas (Sofascore/Odds API)
- Probabilidades implícitas del mercado
- Forma reciente de cada equipo (Sofascore/ESPN)
- H2H últimos 5 enfrentamientos directos (API-Football)
- Posición en tabla + puntos (API-Football)
- Ventaja de local histórica por estadio (API-Football)

DEFINICIONES CLAVE:
- Probabilidad implícita: 1/cuota × 100 (ya con margen eliminado en los datos)
- Probabilidad estimada IA: TU estimación real basada en forma, posición, H2H y contexto
- Índice de Valor (EV) = (prob_IA / 100 × cuota × 100) - 100
  • EV > 5  → Valor fuerte ✅
  • EV 0-5  → Valor débil  ⚠️
  • EV < 0  → Sin valor    ❌

MERCADOS A ANALIZAR:

1. **1X2 (PRIORIDAD ALTA)**: Victoria Local / Empate / Victoria Visitante
   - Analiza SIEMPRE este mercado primero
   - Solo si NO encuentras valor genuino (EV+ >3), analiza mercados alternativos

2. **MÁS/MENOS GOLES (ALTERNATIVO)**: Cuando NO hay valor en 1X2
   - Línea 2.5 goles: Más de 2.5 / Menos de 2.5
   - Línea 1.5 goles: Más de 1.5 / Menos de 1.5
   - Analiza basándote en: goles en H2H, forma ofensiva/defensiva, posición en tabla

METODOLOGÍA DE ANÁLISIS 1X2 (por orden de impacto):

1. VENTAJA DE LOCAL (ALTO IMPACTO):
   - Si un equipo local tiene >65% de victorias en casa → ajusta +8-12% a prob implícita
   - Si tiene <40% de victorias en casa → ajusta -5-8% a prob implícita
   - Combina con forma reciente: local fuerte en casa + racha WWWW = gran valor

2. H2H ÚLTIMOS 5 ENFRENTAMIENTOS (ALTO IMPACTO):
   - Dominio claro (4-5 victorias de uno) → ajusta +10-15% en favor del dominante
   - Equilibrio 2-2-1 o 3-2 → mantén prob implícita sin cambios mayores
   - Contexto: victorias recientes (última temporada) pesan más que antiguas
   - Nota los marcadores: si un equipo siempre gana por 2+ goles, considera handicap/más goles

3. POSICIÓN EN TABLA + PUNTOS (MEDIO IMPACTO):
   - Diferencia >15 puntos → ajusta +8-10% al favorito de tabla
   - Diferencia 8-15 puntos → ajusta +4-6% al favorito
   - Diferencia <8 puntos → peso menor, prioriza forma reciente
   - Equipos peleando descenso (últimos 5) pueden tener motivación extra en casa

4. RACHA RECIENTE EN CASA/FUERA (MEDIO IMPACTO):
   - WWWWW vs LLLLL → ajusta +10-15% al equipo en racha
   - WWDWW vs DLLDD → ajusta +5-8% al equipo en racha
   - Forma en casa para local + forma fuera para visitante son las críticas
   - Una racha de 1 partido no es tendencia, mínimo 3 resultados similares

METODOLOGÍA PARA MÁS/MENOS GOLES:

1. ANÁLISIS DE H2H:
   - Si los últimos 5 H2H tienen >2.5 goles en 4-5 partidos → +10-15% a Más de 2.5
   - Si tienen <2.5 goles en 4-5 partidos → +10-15% a Menos de 2.5
   - Marcadores típicos: 3-1, 4-2 → favorece Más / 1-0, 0-0, 1-1 → favorece Menos

2. FORMA OFENSIVA/DEFENSIVA:
   - Ambos equipos con racha goleadora (>2 goles/partido últimos 5) → Más de 2.5
   - Defensas sólidas (0-1 goles recibidos últimos 5) → Menos de 2.5
   - Equipos arriba en tabla tienden a más goles (ataque fuerte)
   - Equipos abajo en tabla en casa pueden cerrar el partido → Menos

3. LÍNEA 1.5 vs 2.5:
   - Usa 2.5 como estándar para ligas ofensivas (Premier, Bundesliga)
   - Usa 1.5 para partidos muy cerrados o ligas defensivas (Serie A, Ligue 1)
   - Si dudas entre ambas, elige la que tenga mejor cuota/EV

INTEGRACIÓN DE FACTORES:
- Si ventaja de local (70% victorias) + dominio H2H (4-1) + forma WWWW + 10 puntos arriba en tabla
  → VALOR EXCEPCIONAL en 1X2: la prob implícita está muy desajustada, ajusta +20-25%
- Si NO hay valor en 1X2 pero los últimos 5 H2H tuvieron >3 goles + ambos anotan
  → Busca valor en Más de 2.5
- Si las señales se contradicen (ej: buen H2H pero mala racha actual), prioriza racha reciente
- NUNCA inventes valor: si todos los factores están alineados con la prob implícita del mercado, reporta que no hay valor

INSTRUCCIONES:
1. Para cada partido analiza PRIMERO el mercado 1X2 (Victoria Local/Empate/Visitante)
2. Solo si NO encuentras EV+ genuino en 1X2, analiza Más/Menos Goles
3. Usa TODOS los datos disponibles: cuotas, forma, H2H, tabla, ventaja local
4. Si las cuotas no están disponibles, basa tu análisis en contexto histórico del partido
5. Sé conservador: es mejor no reportar que inventar valor
6. En la justificación, menciona los factores clave y el razonamiento específico del mercado
7. NUNCA incluyas un pronóstico con cuota inferior a 1.50. Si no hay una selección de 1.50 o superior con valor, no incluyas ese partido.

FORMATO DE SALIDA:
Devuelve ÚNICAMENTE un array JSON válido. Sin texto extra, sin markdown, sin explicaciones fuera del JSON.

[
  {
    "matchId": <número>,
    "match": "<local> vs <visitante>",
    "league": "<liga>",
    "date": "<YYYY-MM-DD>",
    "time": "<HH:MM>",
    "market": "<"1X2" | "Más/Menos 2.5" | "Más/Menos 1.5">",
    "selection": "<ej: Victoria Local | Empate | Victoria Visitante | Más de 2.5 | Menos de 2.5 | Más de 1.5 | Menos de 1.5>",
    "bookmakerOdds": <decimal>,
    "aiProbability": <entero 0-100>,
    "ev": <decimal 2 decimales>,
    "homeForm": "<últimos 5 resultados local o N/D>",
    "awayForm": "<últimos 5 resultados visitante o N/D>",
    "justification": "<máx 200 caracteres: razón concisa mencionando factores clave y razonamiento específico del mercado>"
  }
]
`.trim()

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Analiza partidos enriquecidos con Sofascore y devuelve oportunidades EV+.
 *
 * @param {string}          apiKey   - Groq API Key
 * @param {EnrichedMatch[]} matches  - Array de sofascoreService.loadMatchesForDate()
 * @returns {Promise<Opportunity[]>}
 */
export async function analyzeMatches(apiKey, matches) {
  if (!apiKey?.trim()) {
    throw new Error('API Key de Groq no configurada. Añádela en el campo superior.')
  }
  if (!matches?.length) {
    throw new Error('No hay partidos para analizar.')
  }

  // Construir bloque de datos para el prompt
  const matchBlock = matches
    .map((m, i) => `--- Partido ${i + 1} ---\n${formatMatchForPrompt(m)}`)
    .join('\n\n')

  const userPrompt =
    `Analiza los siguientes ${matches.length} partidos con datos reales ` +
    `y devuelve un array JSON con las oportunidades de valor (EV+) detectadas.\n\n` +
    `${matchBlock}\n\n` +
    `Recuerda: solo incluye selecciones con EV genuinamente positivo.`

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.2,   // más determinista para análisis financiero
      max_tokens:  4096,
      top_p:       0.9,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = err?.error?.message ?? `HTTP ${response.status}`
    throw new Error(`Error Groq API: ${msg}`)
  }

  const data    = await response.json()
  const content = data.choices?.[0]?.message?.content ?? ''

  // Extraer array JSON — la IA a veces envuelve en ```json ... ```
  const jsonMatch = content.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('La IA no devolvió JSON válido. Vuelve a intentarlo.')
  }

  const parsed = JSON.parse(jsonMatch[0])

  // Re-calcular EV y exigir la cuota mínima en cliente para que la regla no
  // dependa únicamente de que el modelo siga el prompt.
  return parsed
    .map(item => ({
      ...item,
      bookmakerOdds: Number(item.bookmakerOdds),
      ev: parseFloat(
        ((item.aiProbability / 100) * item.bookmakerOdds * 100 - 100).toFixed(2)
      ),
    }))
    .filter(item => Number.isFinite(item.bookmakerOdds) && item.bookmakerOdds >= MINIMUM_ODDS)
}
