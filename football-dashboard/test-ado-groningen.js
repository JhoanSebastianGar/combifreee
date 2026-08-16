/**
 * Script de diagnóstico para ADO Den Haag vs Groningen
 * Ejecutar: node test-ado-groningen.js
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'

// ─── Normalización (misma lógica que espnService.js) ─────────────────────────

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Casos especiales holandeses
    .replace(/\bado den haag\b/g, 'den haag')
    .replace(/\bfc den haag\b/g, 'den haag')
    .replace(/\bfc groningen\b/g, 'groningen')
    .replace(/\bpsv eindhoven\b/g, 'eindhoven psv')
    .replace(/\bajax amsterdam\b/g, 'ajax')
    .replace(/\baz alkmaar\b/g, 'alkmaar')
    // Prefijos genéricos
    .replace(/\b(fc|cf|sc|ac|as|rb|sv|vfb|bv|fk|sk|afc|bsc|ssv|fsv|tsv|vfl|ado)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarity(a, b) {
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.9

  const tokA = new Set(a.split(' ').filter(t => t.length > 2))
  const tokB = new Set(b.split(' ').filter(t => t.length > 2))
  if (!tokA.size || !tokB.size) return 0
  
  let shared = 0
  for (const t of tokA) if (tokB.has(t)) shared++
  
  return shared / Math.max(tokA.size, tokB.size)
}

// ─── Test ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 DIAGNÓSTICO: ADO Den Haag vs Groningen\n')
  console.log('='.repeat(60))

  // 1. Nombres desde Odds API
  const oddsNames = {
    home: 'ADO Den Haag',
    away: 'Groningen',
  }

  console.log('\n1️⃣  NOMBRES DESDE THE ODDS API:')
  console.log(`   Local:     "${oddsNames.home}"`)
  console.log(`   Visitante: "${oddsNames.away}"`)
  console.log(`   Normalizados: "${normalizeName(oddsNames.home)}" vs "${normalizeName(oddsNames.away)}"`)

  // 2. Fetch ESPN Eredivisie scoreboard
  console.log('\n2️⃣  FETCHING ESPN EREDIVISIE SCOREBOARD...')
  try {
    const res = await fetch(`${ESPN_BASE}/ned.1/scoreboard`)
    const data = await res.json()
    const events = data?.events ?? []

    console.log(`   ✅ ${events.length} partidos encontrados en ESPN\n`)

    if (events.length === 0) {
      console.log('   ⚠️  No hay partidos en el scoreboard de Eredivisie')
      return
    }

    // 3. Mostrar todos los equipos disponibles
    console.log('3️⃣  EQUIPOS DISPONIBLES EN ESPN:')
    const espnMatches = []
    
    for (const event of events) {
      const comp = event.competitions?.[0]
      const competitors = comp?.competitors ?? []
      const home = competitors.find(c => c.homeAway === 'home')
      const away = competitors.find(c => c.homeAway === 'away')

      if (home && away) {
        const homeName = home.team?.displayName ?? ''
        const awayName = away.team?.displayName ?? ''
        const homeForm = home.form ?? 'N/D'
        const awayForm = away.form ?? 'N/D'

        espnMatches.push({ homeName, awayName, homeForm, awayForm })

        console.log(`   ${homeName} vs ${awayName}`)
        console.log(`      Normalizados: "${normalizeName(homeName)}" vs "${normalizeName(awayName)}"`)
        console.log(`      Forma: ${homeForm} vs ${awayForm}`)
      }
    }

    // 4. Intentar matching
    console.log('\n4️⃣  MATCHING TEST:')
    const homeN = normalizeName(oddsNames.home)
    const awayN = normalizeName(oddsNames.away)

    let bestMatch = null
    let bestScore = 0

    for (const match of espnMatches) {
      const espnHomeN = normalizeName(match.homeName)
      const espnAwayN = normalizeName(match.awayName)

      const sHome = similarity(homeN, espnHomeN)
      const sAway = similarity(awayN, espnAwayN)
      const score = sHome * sAway

      console.log(`\n   "${match.homeName}" vs "${match.awayName}"`)
      console.log(`      Home similarity: ${(sHome * 100).toFixed(1)}%`)
      console.log(`      Away similarity: ${(sAway * 100).toFixed(1)}%`)
      console.log(`      Score total:     ${(score * 100).toFixed(1)}% ${score >= 0.4 ? '✅ MATCH' : '❌'}`)

      if (score > bestScore && score >= 0.4) {
        bestScore = score
        bestMatch = match
      }
    }

    // 5. Resultado
    console.log('\n5️⃣  RESULTADO:')
    if (bestMatch) {
      console.log(`   ✅ MATCH ENCONTRADO (${(bestScore * 100).toFixed(1)}%):`)
      console.log(`      ${bestMatch.homeName} vs ${bestMatch.awayName}`)
      console.log(`      Forma: ${bestMatch.homeForm} vs ${bestMatch.awayForm}`)
    } else {
      console.log('   ❌ NO SE ENCONTRÓ MATCH')
      console.log('   Razones posibles:')
      console.log('   - Los nombres son muy diferentes')
      console.log('   - El partido no está en el scoreboard actual de ESPN')
      console.log('   - ESPN usa nombres diferentes (ej: "Den Haag" vs "ADO Den Haag")')
    }

  } catch (err) {
    console.error('   ❌ Error:', err.message)
  }

  console.log('\n' + '='.repeat(60) + '\n')
}

main()
