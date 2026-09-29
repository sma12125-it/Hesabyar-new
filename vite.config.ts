import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

function getBase(): string {
  if (process.env.VITE_BASE_URL) return process.env.VITE_BASE_URL
  if (process.env.BASE_URL) return process.env.BASE_URL
  if (process.env.GITHUB_REPOSITORY) {
    const repo = process.env.GITHUB_REPOSITORY.split('/')[1]
    if (repo && !repo.endsWith('.github.io')) {
      return `/${repo}/`
    }
  }
  if (process.env.GITHUB_ACTIONS === 'true') {
    return '/hesabyar/'
  }
  return '/'
}

export default defineConfig({
  base: getBase(),
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  plugins: [
    react(),
    {
      name: 'copy-index-to-404',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist')
        const indexHtml = resolve(distDir, 'index.html')
        const notFoundHtml = resolve(distDir, '404.html')
        if (existsSync(indexHtml)) {
          copyFileSync(indexHtml, notFoundHtml)
        }
      },
    },
  ],
  test: {
    environment: 'node',
  },
})
