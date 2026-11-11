import type { ConfigContext, ExpoConfig } from 'expo/config';

const BACKGROUND_DARK = '#0B0B0B';
const BACKGROUND_LIGHT = '#FFFFFF';

// Build-time only (not bundled into JS): reversed iOS OAuth client ID, e.g.
// com.googleusercontent.apps.1234-abcd. The Google Sign-In plugin is only needed for iOS.
const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ProjectX',
  slug: 'project-x',
  scheme: 'projectx',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.projectx.app',
    supportsTablet: false,
    usesAppleSignIn: true,
  },
  android: {
    package: 'com.projectx.app',
    adaptiveIcon: {
      backgroundColor: BACKGROUND_DARK,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  // Web app (PWA, hosted on Expo Hosting): one index.html for every route; public/ holds the
  // manifest, icons, service worker and the iPhone home-screen tags (public/index.html).
  web: {
    output: 'single',
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-apple-authentication',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 120,
        backgroundColor: BACKGROUND_LIGHT,
        dark: { backgroundColor: BACKGROUND_DARK },
      },
    ],
    ...(googleIosUrlScheme
      ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }] as [string, object]]
      : []),
  ],
  experiments: { typedRoutes: true },
  owner: 'radsadi26',
  extra: { ...config.extra, eas: { projectId: '4967cbc7-3da7-409b-84ec-f117b923c02c' } },
});
