import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ather.music',
  appName: 'ATHER',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'https://*.youtube.com',
      'https://*.ytimg.com',
      'https://*.googlevideo.com',
      'https://itunes.apple.com',
      'https://*.mzstatic.com',
      'https://api.deezer.com',
      'https://*.dzcdn.net',
      'https://lrclib.net',
      'https://musicbrainz.org',
      'https://rss.marketingtools.apple.com',
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
