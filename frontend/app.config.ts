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
});
