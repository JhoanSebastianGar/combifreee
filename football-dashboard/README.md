# ⚽ Football Value Finder

Dashboard de **value betting** para fútbol con análisis de IA basado en **datos reales** de múltiples fuentes.

![Stack](https://img.shields.io/badge/React-18.3-blue) ![Vite](https://img.shields.io/badge/Vite-6.4-purple) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-cyan) ![Groq](https://img.shields.io/badge/Groq-llama--3.3--70b-green)

---

## 🎯 Características

- ✅ **Cuotas Reales** de Sofascore o The Odds API (Pinnacle, Bet365, Unibet)
- ✅ **Forma Pre-Partido** de ESPN (racha WWDLW)
- ✅ **H2H** (últimos 5 enfrentamientos directos) con API-Football
- ✅ **Standings** (posición en tabla + puntos) con API-Football
- ✅ **Home Advantage** (% victorias en casa) con API-Football
- ✅ **Análisis de IA** con Groq (openai/gpt-oss-120b)
- ✅ **Cálculo de EV+** (Expected Value) automático
- ✅ **Cuota mínima de 1.50**: se descartan automáticamente pronósticos con cuotas inferiores
- ✅ **Historial & Rentabilidad** con métricas (P/L, Yield, Win Rate)
- ✅ **Resultados automáticos** cada 30 segundos para apuestas pendientes
- ✅ **Orden por fecha** en el historial (más reciente primero, conmutables desde el encabezado)
- ✅ **Persistencia** en localStorage
- ✅ **Dark Mode** deportivo
- ✅ **Fallback robusto** (3 capas: Sofascore → Odds API → Mock)

---

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone <repo-url>
cd football-dashboard

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env y añadir tu Groq API Key

# Iniciar servidor de desarrollo
npm run dev
```

---

## 🔑 Configuración de API keys

Ninguna clave se incluye en el repositorio. Copia `.env.example` a `.env` y añade tus propias credenciales:

```env
VITE_GROQ_API_KEY=tu_clave_de_groq
VITE_ODDS_API_KEY=tu_clave_de_the_odds_api
VITE_APIFOOTBALL_API_KEY=tu_clave_de_api_football
```

- **Groq** es necesaria para generar el análisis.
- **The Odds API** es el respaldo cuando Sofascore no está disponible (plan gratuito: 500 solicitudes/mes).
- **API-Football** añade H2H, clasificación y ventaja de local (plan gratuito: 100 solicitudes/día).

No publiques el archivo `.env` ni pegues claves en el README, issues o commits.

---

## 📊 Cadena de Datos

```
1. Sofascore / The Odds API
   ↓ (cuotas + probabilidades implícitas)
   
2. ESPN
   ↓ (forma pre-partido WWDLW)
   
3. API-Football ⭐ NUEVO
   ↓ (H2H + standings + home advantage)
   
4. Groq IA (openai/gpt-oss-120b)
   ↓ (análisis con metodología avanzada)
   
5. ✨ Oportunidades EV+ con justificación enriquecida
   ↓ (solo cuotas ≥ 1.50)

6. Historial y actualización automática de resultados
```

---

## 🧠 Metodología de Análisis IA

El modelo utiliza una **metodología cuantitativa** con 4 factores clave:

### 1. **Ventaja de Local** (ALTO IMPACTO)
- >65% victorias en casa → +8-12% ajuste a prob implícita
- <40% victorias en casa → -5-8% ajuste

### 2. **H2H Últimos 5** (ALTO IMPACTO)
- Dominio claro (4-5 victorias) → +10-15% ajuste
- Equilibrio → sin cambios mayores

### 3. **Posición en Tabla** (MEDIO IMPACTO)
- Diferencia >15 puntos → +8-10% al favorito
- <8 puntos → prioriza forma reciente

### 4. **Racha Casa/Fuera** (MEDIO IMPACTO)
- WWWWW vs LLLLL → +10-15% ajuste
- Mínimo 3 resultados similares = tendencia

**Integración**: Si todos los factores alinean → **VALOR EXCEPCIONAL** (+20-25% ajuste total)

---

## 📁 Estructura del Proyecto

```
football-dashboard/
├── src/
│   ├── components/          # Componentes UI
│   │   ├── MatchTable.jsx   # Tabla de oportunidades
│   │   ├── HistorialView.jsx
│   │   ├── EvBadge.jsx
│   │   ├── ProbabilityBar.jsx
│   │   └── ...
│   ├── services/            # Servicios de datos
│   │   ├── sofascoreService.js     # Sofascore API
│   │   ├── oddsApiService.js       # The Odds API + ESPN
│   │   ├── apiFootballService.js   # API-Football (H2H, standings)
│   │   ├── espnService.js          # ESPN (forma)
│   │   └── groqService.js          # Groq IA
│   ├── hooks/
│   │   ├── useHistorial.js     # Gestión de historial
│   │   └── useMatchResults.js  # Polling y actualización de resultados
│   ├── data/
│   │   └── mockMatches.json # Datos de fallback
│   ├── App.jsx              # Componente principal
│   └── main.jsx
├── .env                     # Variables de entorno
├── MEJORAS_IA_PROMPT.md    # Documentación técnica
└── test-api-football.js    # Script de prueba
```

---

## 🧪 Pruebas

### Probar API-Football:
```bash
node test-api-football.js
```

Verifica:
- ✅ Búsqueda de fixtures
- ✅ H2H (últimos 5 enfrentamientos)
- ✅ Standings (posición en tabla)
- ✅ Home Advantage (% victorias en casa)
- ⚡ Requests restantes del día

---

## 📦 Build para Producción

```bash
npm run build
npm run preview  # vista previa local
```

**Notas**:
- El proxy de Sofascore en `vite.config.js` solo funciona en desarrollo
- Para producción necesitarás configurar un proxy real (Nginx, Cloudflare Worker, etc.)
- The Odds API y API-Football funcionan directo en producción

---

## 🎨 Paleta de Colores

```css
pitch-950  → #0a0e0f  (fondo principal)
pitch-900  → #141b1e  (tarjetas)
pitch-800  → #1e2a2f  (bordes)
pitch-700  → #2d3f46
pitch-600  → #5a7381  (texto secundario)

accent-green  → #00ff88  (valor positivo)
accent-blue   → #00b8ff  (información)
accent-yellow → #ffd700  (cuotas)
accent-red    → #ff4757  (pérdidas)
```

---

## 🔄 Historial & Rentabilidad

- **P/L** (Profit/Loss): Beneficio total en unidades
- **Yield %**: `(P/L / Unidades Totales Apostadas) × 100`
- **Win Rate %**: `(Ganadas / Resueltas) × 100`
- **Estados**: Pendiente, Ganada, Perdida, Anulada
- **Stake editable**: 1 unidad por defecto
- **Gráfico P/L**: Últimas 20 apuestas resueltas
- **Orden de fecha**: más reciente primero; pulsa “Fecha” para invertirlo
- **Actualización automática**: consulta cada 30 segundos las apuestas pendientes
- **Cobertura de resultados**: Sofascore para eventos con ID guardado (incluida K League 1) y ESPN como respaldo para Bundesliga 2, Premier League de Rusia, Super League de Turquía y Coppa Italia, entre otras
- **Persistencia**: localStorage (`fvf_historial_v1`)

---

## 📚 Documentación Adicional

- [`MEJORAS_IA_PROMPT.md`](./MEJORAS_IA_PROMPT.md): Detalles técnicos de la integración con API-Football
- [`.env.example`](./.env.example): Plantilla de variables de entorno

---

## ⚠️ Advertencia Legal

Esta aplicación es **solo informativa** y para fines educativos.

- ⚠️ No constituye asesoramiento financiero
- ⚠️ Las apuestas deportivas conllevan riesgo
- ⚠️ Apuesta con responsabilidad
- ⚠️ Solo si es legal en tu jurisdicción

---

## 🛠️ Stack Técnico

- **React 18.3** + **Vite 6.4**
- **Tailwind CSS 3.4**
- **Groq** (openai/gpt-oss-120b)
- **Sofascore API** (no oficial)
- **The Odds API**
- **ESPN API**
- **API-Football v3**

---

## 📄 Licencia

MIT

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea tu feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

**Desarrollado con Kiro AI Assistant** ⚡
