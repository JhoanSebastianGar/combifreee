/**
 * Script de prueba para API-Football
 * 
 * Ejecutar: node test-api-football.js
 */

const API_KEY = '6351441914dbce582c490cc752ca08df'
const BASE = 'https://v3.football.api-sports.io'

const HEADERS = {
  'x-apisports-key': API_KEY,
  'Accept': 'application/json',
}

async function testFixtures() {
  console.log('\n🔍 Testeando búsqueda de fixtures...\n')
  
  try {
    // Buscar partidos de Premier League para hoy
    const today = new Date().toISOString().split('T')[0]
    const leagueId = 39  // Premier League
    const season = new Date().getFullYear()
    
    const url = `${BASE}/fixtures?league=${leagueId}&season=${season}&date=${today}`
    console.log(`📡 Request: ${url}`)
    
    const res = await fetch(url, { headers: HEADERS })
    const data = await res.json()
    
    console.log(`✅ Status: ${res.status}`)
    console.log(`📊 Fixtures encontrados: ${data.response?.length ?? 0}`)
    
    if (data.response?.length > 0) {
      const first = data.response[0]
      console.log('\n📌 Primer partido:')
      console.log(`   ${first.teams.home.name} vs ${first.teams.away.name}`)
      console.log(`   Fixture ID: ${first.fixture.id}`)
      console.log(`   Home ID: ${first.teams.home.id}`)
      console.log(`   Away ID: ${first.teams.away.id}`)
    }
    
    console.log(`\n⚡ Requests restantes hoy: ${data.requests?.current ?? 'N/D'}/${data.requests?.limit_day ?? 'N/D'}`)
    
  } catch (err) {
    console.error('❌ Error:', err.message)
  }
}

async function testH2H() {
  console.log('\n🔍 Testeando H2H...\n')
  
  try {
    // Manchester City (50) vs Arsenal (42)
    const homeId = 50
    const awayId = 42
    
    const url = `${BASE}/fixtures/headtohead?h2h=${homeId}-${awayId}&last=5`
    console.log(`📡 Request: ${url}`)
    
    const res = await fetch(url, { headers: HEADERS })
    const data = await res.json()
    
    console.log(`✅ Status: ${res.status}`)
    console.log(`📊 H2H encontrados: ${data.response?.length ?? 0}`)
    
    if (data.response?.length > 0) {
      console.log('\n📌 Últimos enfrentamientos:')
      data.response.slice(0, 5).forEach(f => {
        const date = f.fixture.date.split('T')[0]
        const home = f.teams.home.name
        const away = f.teams.away.name
        const score = `${f.goals.home}-${f.goals.away}`
        const winner = f.teams.home.winner ? '🏠' : f.teams.away.winner ? '✈️' : '🤝'
        console.log(`   ${winner} ${home} ${score} ${away} (${date})`)
      })
    }
    
    console.log(`\n⚡ Requests restantes hoy: ${data.requests?.current ?? 'N/D'}/${data.requests?.limit_day ?? 'N/D'}`)
    
  } catch (err) {
    console.error('❌ Error:', err.message)
  }
}

async function testStandings() {
  console.log('\n🔍 Testeando Standings...\n')
  
  try {
    // Premier League 2024
    const leagueId = 39
    const season = 2024
    
    const url = `${BASE}/standings?league=${leagueId}&season=${season}`
    console.log(`📡 Request: ${url}`)
    
    const res = await fetch(url, { headers: HEADERS })
    const data = await res.json()
    
    console.log(`✅ Status: ${res.status}`)
    
    if (data.response?.[0]?.league?.standings?.[0]) {
      const standings = data.response[0].league.standings[0]
      console.log(`📊 Equipos en tabla: ${standings.length}`)
      console.log('\n📌 Top 5:')
      standings.slice(0, 5).forEach(s => {
        console.log(`   ${s.rank}° ${s.team.name} · ${s.points}pts (${s.all.played} PJ) · Forma: ${s.form}`)
      })
    }
    
    console.log(`\n⚡ Requests restantes hoy: ${data.requests?.current ?? 'N/D'}/${data.requests?.limit_day ?? 'N/D'}`)
    
  } catch (err) {
    console.error('❌ Error:', err.message)
  }
}

async function testHomeAdvantage() {
  console.log('\n🔍 Testeando Home Advantage...\n')
  
  try {
    // Manchester City (50)
    const teamId = 50
    const season = 2024
    
    const url = `${BASE}/fixtures?team=${teamId}&season=${season}&venue=home&status=FT`
    console.log(`📡 Request: ${url}`)
    
    const res = await fetch(url, { headers: HEADERS })
    const data = await res.json()
    
    console.log(`✅ Status: ${res.status}`)
    
    if (data.response?.length > 0) {
      const fixtures = data.response
      const won = fixtures.filter(f => f.teams.home.winner === true).length
      const total = fixtures.length
      const pct = ((won / total) * 100).toFixed(1)
      
      console.log(`📊 Partidos en casa: ${total}`)
      console.log(`✅ Victorias: ${won}`)
      console.log(`📈 % Victorias en casa: ${pct}%`)
    }
    
    console.log(`\n⚡ Requests restantes hoy: ${data.requests?.current ?? 'N/D'}/${data.requests?.limit_day ?? 'N/D'}`)
    
  } catch (err) {
    console.error('❌ Error:', err.message)
  }
}

async function main() {
  console.log('\n🧪 TEST API-FOOTBALL INTEGRATION\n')
  console.log('='.repeat(50))
  
  await testFixtures()
  console.log('\n' + '='.repeat(50))
  
  await testH2H()
  console.log('\n' + '='.repeat(50))
  
  await testStandings()
  console.log('\n' + '='.repeat(50))
  
  await testHomeAdvantage()
  console.log('\n' + '='.repeat(50))
  
  console.log('\n✅ Tests completados\n')
}

main()
