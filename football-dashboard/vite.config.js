import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Redirige /api-sofascore/* → https://api.sofascore.app/api/v1/*
      // Esto evita el bloqueo CORS en desarrollo: el browser habla con
      // localhost y Vite reenvía la petición server-side añadiendo los
      // headers necesarios.
      '/api-sofascore': {
        target: 'https://api.sofascore.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api-sofascore/, '/api/v1'),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Referer: 'https://www.sofascore.com/',
          Origin:  'https://www.sofascore.com',
        },
      },
    },
  },
})
