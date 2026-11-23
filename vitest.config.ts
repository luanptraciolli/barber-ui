import { defineConfig } from 'vitest/config'
import path from 'node:path'

process.env.TZ = 'UTC'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
