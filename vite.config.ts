import { redact } from '@tanstack/redact/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // `nano` ships none of Redact's optional features (context, Suspense, portals,
  // hydration, ...). This app only needs hooks and createRoot, so it stays tiny.
  plugins: [redact({ preset: 'nano' })],
  build: {
    target: 'es2022',
    // Keep the CSS and fonts as separate cacheable files; no inline data URIs
    // beyond what the stylesheet itself declares.
    assetsInlineLimit: 0,
  },
})
