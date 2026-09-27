import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// `npm run dev:phone` uses --mode phone: HTTPS on your local network,
// because phones only allow the microphone on HTTPS pages.
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  server: {
    host: mode === 'phone',
    // Vite only answers requests for addresses it knows (protection against
    // "DNS rebinding" attacks). Allow ngrok's tunnel addresses so the app can
    // be opened on a phone through `ngrok http 5173`. The leading dot means
    // "any subdomain", e.g. abcd-1234.ngrok-free.app.
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app'],
    proxy: {
      "/api": "http://localhost:5001",
    },
  },
}));
