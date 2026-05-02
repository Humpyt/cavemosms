import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bulksms.groupmessage',
  appName: 'Bulk SMS',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      showSpinner: false,
      backgroundColor: '#0B1324',
    },
  },
};

export default config;
