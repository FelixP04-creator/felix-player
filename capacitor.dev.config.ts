import type { CapacitorConfig } from '@capacitor/cli';
import base from './capacitor.config';

// NUR für Entwicklung: WebView lädt den Vite-Dev-Server (HMR/Live-Reload).
// Aufruf:  npx cap sync android --config capacitor.dev.config.ts
// - Emulator:      10.0.2.2 = Host-PC
// - Echtes Handy:  LAN-IP des PCs (Vite mit --host starten)
const config: CapacitorConfig = {
  ...base,
  server: {
    url: 'http://localhost:5173',
    androidScheme: 'https',
  },
};

export default config;
