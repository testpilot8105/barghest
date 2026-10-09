import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Blueprint ships prebuilt CSS, so no CSS plugin here. The app runs on 5180; the engine (faux over HTTP plus the
// /barghest/* routes) runs on 8787 and is reached through this proxy, so the browser only ever talks to one origin.
// The ontology client in src/data/ is created with window.location.origin for that reason.
const ENGINE = 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      '/api': ENGINE,
      '/barghest': ENGINE,
    },
  },
  // cssTarget keeps modern CSS (color-mix(), light-dark(), nesting) native in the build instead of lowered for
  // browsers this app does not serve.
  build: { outDir: 'dist', emptyOutDir: true, cssTarget: ['chrome123', 'safari17.5', 'firefox120'] },
});
