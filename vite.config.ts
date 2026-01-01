import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mock-offline-sync',
      configureServer(server) {
        server.middlewares.use('/api/offline-sync', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            return res.end()
          }
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 200
            res.end(JSON.stringify({ ok: true }))
          })
        })
      }
    }
  ]
})
