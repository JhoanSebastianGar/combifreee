// save_predictions_server.js
// Node/Express minimal para recibir oportunidades y append a predictions.csv
// Ejecutar: node save_predictions_server.js

const express = require('express')
const fs = require('fs')
const path = require('path')
const app = express()
app.use(express.json({ limit: '2mb' }))

const CSV_PATH = path.resolve(__dirname, 'predictions.csv')

function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return `"${s.replace(/"/g, '""')}"`
}

function ensureHeader() {
  if (!fs.existsSync(CSV_PATH)) {
    const header = [
      'fecha',
      'equipo_local',
      'equipo_visitante',
      'fixture_id',
      'mercado',
      'seleccion',
      'probabilidad_estimada',
      'cuota_real',
      'ev_calculado',
    ].join(',') + '\n'
    fs.writeFileSync(CSV_PATH, header, { encoding: 'utf8' })
  }
}

app.post('/api/predictions', (req, res) => {
  const body = req.body || {}
  const opportunities = Array.isArray(body.opportunities) ? body.opportunities : []
  if (opportunities.length === 0) {
    return res.status(400).json({ ok: false, message: 'No opportunities provided' })
  }

  ensureHeader()

  const lines = opportunities.map(o => {
    const fecha = o.date ?? o.fecha ?? ''
    const equipo_local = o.home ?? o.equipo_local ?? (o.match ? String(o.match).split(' vs ')[0] : '')
    const equipo_visitante = o.away ?? o.equipo_visitante ?? (o.match ? String(o.match).split(' vs ')[1] : '')
    const fixture_id = o.matchId ?? o.fixture_id ?? o.id ?? ''
    const mercado = o.market ?? o.mercado ?? ''
    const seleccion = o.selection ?? o.seleccion ?? ''
    const prob = (o.aiProbability ?? o.probabilidad_estimada ?? '')
    const cuota = (o.bookmakerOdds ?? o.cuota_real ?? '')
    const ev = (typeof o.ev !== 'undefined') ? o.ev : (
      (Number(prob) ? (Number(prob) / 100.0) * Number(cuota) * 100.0 - 100.0 : '')
    )

    return [
      csvEscape(fecha),
      csvEscape(equipo_local),
      csvEscape(equipo_visitante),
      csvEscape(fixture_id),
      csvEscape(mercado),
      csvEscape(seleccion),
      csvEscape(prob),
      csvEscape(cuota),
      csvEscape(ev),
    ].join(',')
  })

  try {
    fs.appendFileSync(CSV_PATH, lines.join('\n') + '\n', { encoding: 'utf8' })
    return res.json({ ok: true, added: opportunities.length })
  } catch (err) {
    console.error('Error writing CSV', err)
    return res.status(500).json({ ok: false, message: 'IO error' })
  }
})

const PORT = process.env.PRED_SERVER_PORT || 3001
app.listen(PORT, () => console.log(`predictions server listening on http://localhost:${PORT}`))
