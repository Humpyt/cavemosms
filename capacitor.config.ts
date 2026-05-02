import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bulksms.groupmessage',
  appName: 'Camo SMS',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      showSpinner: false,
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
