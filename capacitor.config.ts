import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.felix.player',
  appName: 'felix Player',
  webDir: 'dist',
  // Keine server.url hier: die App lädt die eingebauten dist-Assets.
  // Für Entwicklung mit Live-Reload: npx cap sync --config capacitor.dev.config.ts
  androidScheme: 'https',
  android: {
    allowMixedContent: false,
  },
};

export default config;
