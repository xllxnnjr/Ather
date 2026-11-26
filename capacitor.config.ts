import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ather.music',
  appName: 'Ather',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'https://itunes.apple.com',
      'https://*.mzstatic.com',
      'https://rss.marketingtools.apple.com',
      'https://discoveryprovider.audius.co',
      'https://*.audius.co',
      'https://*.audius-content.com',
      'https://api.deezer.com',
      'https://*.dzcdn.net',
      'https://lrclib.net',
      'https://musicbrainz.org',
      'https://music.youtube.com',
      'https://www.youtube.com',
      'https://*.googlevideo.com',
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.adminforge.de',
      'https://piped-api.garudalinux.org',
      'https://pipedapi.smnz.de',
      'https://*.firebaseapp.com',
      'https://*.googleapis.com',
      'https://accounts.google.com',
    ],
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#000000',
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
