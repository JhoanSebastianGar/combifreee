/**
 * groqService.js
 * Llama a Groq (llama-3.3-70b-versatile) para analizar partidos enriquecidos
 * con datos reales de Sofascore (cuotas + forma pre-partido).
 */

import { formatMatchForPrompt } from './sofascoreService.js'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL        = 'llama-3.3-70b-versatile'

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

METODOLOGÍA DE ANÁLISIS (por orden de impacto):

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

INTEGRACIÓN DE FACTORES:
- Si ventaja de local (70% victorias) + dominio H2H (4-1) + forma WWWW + 10 puntos arriba en tabla
  → VALOR EXCEPCIONAL: la prob implícita está muy desajustada, ajusta +20-25%
- Si las señales se contradicen (ej: buen H2H pero mala racha actual), prioriza racha reciente
- NUNCA inventes valor: si todos los factores están alineados con la prob implícita del mercado, reporta que no hay valor

INSTRUCCIONES:
1. Para cada partido analiza los 3 mercados principales (1, X, 2) y selecciona
   SOLO los que tengan EV positivo genuino tras aplicar la metodología.
2. Usa TODOS los datos disponibles: cuotas, forma, H2H, tabla, ventaja local.
3. Si las cuotas no están disponibles, basa tu análisis en contexto histórico del partido.
4. Sé conservador: es mejor no reportar que inventar valor.
5. En la justificación, menciona los factores clave (ej: "Local 75% victorias casa + domina H2H 4-1").

FORMATO DE SALIDA:
Devuelve ÚNICAMENTE un array JSON válido. Sin texto extra, sin markdown, sin explicaciones fuera del JSON.

[
  {
    "matchId": <número>,
    "match": "<local> vs <visitante>",
    "league": "<liga>",
    "date": "<YYYY-MM-DD>",
    "time": "<HH:MM>",
    "market": "<"1X2" | "Más/Menos 2.5" | "BTTS">",
    "selection": "<ej: Victoria Local | Empate | Victoria Visitante | Más de 2.5 | Ambos Anotan - Sí>",
    "bookmakerOdds": <decimal>,
    "aiProbability": <entero 0-100>,
    "ev": <decimal 2 decimales>,
    "homeForm": "<últimos 5 resultados local o N/D>",
    "awayForm": "<últimos 5 resultados visitante o N/D>",
    "justification": "<máx 180 caracteres: razón concisa mencionando factores clave (H2H, ventaja local, tabla, forma)>"
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
    `Analiza los siguientes ${matches.length} partidos con datos reales de Sofascore ` +
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

  // Re-calcular EV en cliente para garantizar consistencia matemática
  return parsed.map(item => ({
    ...item,
    ev: parseFloat(
      ((item.aiProbability / 100) * item.bookmakerOdds * 100 - 100).toFixed(2)
    ),
  }))
}
