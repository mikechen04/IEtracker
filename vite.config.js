import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // github project page: https://mikechen04.github.io/IEtracker/
  base: process.env.GITHUB_PAGES === 'true' ? '/IEtracker/' : '/',
  plugins: [react()],
  server: {
    // proxy the mcci api so we don't get cors errors in the browser
    proxy: {
      '/mcci-api': {
        target: 'https://api.mccisland.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mcci-api/, ''),
      },
    },
  },
})
