# felix Player

Eigene, dunkle Spotify-Player-App für Android – **dein Spotify-Konto, deine Hülle.**

Die App streamt Musik ausschließlich über die **offiziellen Spotify-Schnittstellen**
(Web Playback SDK + Web API, OAuth **Authorization Code Flow mit PKCE**). Sie
erscheint in Spotify als eigenes Wiedergabegerät **„felix Player"**. Kein Modding,
keine internen Endpoints.

Der OAuth-Flow bringt einen **Refresh-Token** mit: Der Account verlängert sich
automatisch und muss nicht erneut verbunden werden.

## Features

- Top-30, Suche, Bibliothek (Playlists + Gefällt mir)
- Eigene Player-UI: Mini-Player, Bottom-Sheet, Seek-Bar, Shuffle/Repeat, Like
- Konto wird **dauerhaft** in der App gespeichert (einmal verbinden, danach kein Login mehr)
- Eigenständiges Android-Package via [Capacitor](https://capacitorjs.com)

## APK herunterladen

Im Bereich **[Releases](../../releases)** liegt das aktuelle `app-debug.apk`
als Download-Asset. Auf dem Handy installieren:

1. APK aufs Handy kopieren (Kabel, E-Mail an sich selbst, …)
2. Datei antippen → „Unbekannte Quellen" erlauben → installieren
3. App starten → **„Mit Spotify verbinden"** → im Browser anmelden → fertig

> Hinweis: Streaming erfordert ein **Spotify-Premium**-Konto.
> Das Debug-APK ist mit dem Debug-Key signiert – es kann nur auf Geräten installiert
> werden, auf denen keine andere Signature des App-Pakets `de.felix.player` existiert.

## Spotify Developer-Setup (einmalig)

1. [developer.spotify.com](https://developer.spotify.com/dashboard) → **Create App**
2. **Redirect URIs** eintragen:
   - `http://localhost:5173/` (Web-Entwicklung)
   - `spotifyapp://callback` (Android-App)
3. Die Client-ID als Umgebungsvariable eintragen:

```bash
echo "VITE_SPOTIFY_CLIENT_ID=<deine-id>" > .env
```

Der Client-ID-Wert ist **kein Secret** (steht ohnehin im gebauten JS-Bundle),
der OAuth-Flow nutzt nur den Implicit Grant ohne Client-Secret.

## Entwicklung

```bash
npm install
npm run dev            # Web: http://localhost:5173
```

### Android-App bauen

```bash
npm run build          # Web-App nach dist/
npx cap sync android   # Assets + Config in android/
cd android
./gradlew.bat assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

Für Live-Reload im WebView (optional): Vite mit `--host` starten, dann
`npx cap sync android --config capacitor.dev.config.ts`.

## Stack

React 19 · TypeScript · Vite · zustand · Capacitor · Spotify Web Playback SDK

## Qualität

Lighthouse (mobile, headless): **Accessibility 100 / Best Practices 100**,
keine offenen Fehler. Reduced-Motion und Touch-Ziele (≥44px) berücksichtigt.
