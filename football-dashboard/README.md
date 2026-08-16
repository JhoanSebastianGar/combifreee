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
- ✅ **Análisis de IA** con Groq (llama-3.3-70b-versatile)
- ✅ **Cálculo de EV+** (Expected Value) automático
- ✅ **Historial & Rentabilidad** con métricas (P/L, Yield, Win Rate)
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

## 🔑 API Keys Requeridas

### **Obligatoria**:
- **Groq API Key**: [https://console.groq.com/keys](https://console.groq.com/keys)
  - Añadir en `.env`: `VITE_GROQ_API_KEY=tu_key_aquí`

### **Incluidas** (ya configuradas):
- **The Odds API**: `5af72f93d1358d5ec2e19d93a93ff1bb` (fallback)
  - Plan Free: 500 requests/mes
- **API-Football**: `6351441914dbce582c490cc752ca08df` (datos avanzados)
  - Plan Free: 100 requests/día

---

## 📊 Cadena de Datos

```
1. Sofascore / The Odds API
   ↓ (cuotas + probabilidades implícitas)
   
2. ESPN
   ↓ (forma pre-partido WWDLW)
   
3. API-Football ⭐ NUEVO
   ↓ (H2H + standings + home advantage)
   
4. Groq IA (llama-3.3-70b-versatile)
   ↓ (análisis con metodología avanzada)
   
5. ✨ Oportunidades EV+ con justificación enriquecida
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
│   │   └── useHistorial.js  # Gestión de historial
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
- **Groq** (llama-3.3-70b-versatile)
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
