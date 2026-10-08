import express from 'express'
import cors from 'cors'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { apiRouter } from './src/server/apiRouter'

const app = express()
const PORT = Number(process.env.PORT) || 3000
const isProd = process.env.NODE_ENV === 'production'

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Mount RESTful API routes
app.use('/api/v1', apiRouter)

async function startServer() {
  if (!isProd) {
    const { createServer } = await import('vite')
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = resolve(process.cwd(), 'dist')
    if (existsSync(distPath)) {
      app.use(express.static(distPath))
      app.get('*', (_req, res) => {
        res.sendFile(resolve(distPath, 'index.html'))
      })
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HesabYar] Full-Stack server running at http://0.0.0.0:${PORT}`)
  })
}

void startServer()
