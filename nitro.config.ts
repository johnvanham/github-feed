import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  preset: 'node-server',
  publicAssets: [
    {
      baseURL: '/',
      dir: 'public',
      maxAge: 60 * 60 * 24 * 7 // 7 days cache for static assets
    }
  ]
})