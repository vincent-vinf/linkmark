import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: 'linkmark-development-csp',
      transformIndexHtml(html) {
        // Vite injects styles for HMR. Keep the strict CSP in production, but
        // omit its meta tag only from the local development response.
        return command === 'serve'
          ? html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*\/>/, '')
          : html;
      },
    },
  ],
}));
