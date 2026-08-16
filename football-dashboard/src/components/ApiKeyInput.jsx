import { useState } from 'react'

/**
 * Input para la API Key de Groq con toggle de visibilidad
 */
export default function ApiKeyInput({ value, onChange }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-pitch-600 text-sm">🔑</span>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
          className="w-full bg-pitch-800 border border-pitch-700 rounded-lg pl-9 pr-10 py-2 text-sm text-white
                     placeholder-pitch-600 focus:outline-none focus:border-accent-blue focus:ring-1
                     focus:ring-accent-blue/40 transition-colors"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-pitch-600 hover:text-white transition-colors text-sm"
          tabIndex={-1}
          aria-label={visible ? 'Ocultar API key' : 'Mostrar API key'}
        >
          {visible ? '🙈' : '👁️'}
        </button>
      </div>
      <a
        href="https://console.groq.com/keys"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-accent-blue hover:underline whitespace-nowrap"
      >
        Obtener API Key →
      </a>
    </div>
  )
}
