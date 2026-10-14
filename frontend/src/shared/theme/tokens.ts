import type { TextStyle } from 'react-native';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, screen: 16 } as const;

export const radius = { field: 14, card: 16, logo: 12, pill: 999 } as const;

export const sizes = { field: 52, primaryButton: 52, secondaryButton: 46, logo: 50, headerLogo: 36, appBar: 56 } as const;

export const typography = {
  wordmark: { fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  headerWordmark: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.2 },
  /** Auth screen headings ("Log In to ProjectX"). */
  largeTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  /** Tab app bar titles ("Home", "You"). */
  appBarTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  /** Big title of a feed activity ("Morning Pickleball"). */
  activityTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.2 },
  /** Numbers in a feed activity's stats row. */
  stat: { fontSize: 20, fontWeight: '600' },
  screenTitle: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 14, fontWeight: '400' },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  field: { fontSize: 15, fontWeight: '600' },
  button: { fontSize: 16, fontWeight: '700' },
  secondaryButton: { fontSize: 15, fontWeight: '700' },
  link: { fontSize: 13, fontWeight: '700' },
  caption: { fontSize: 12, fontWeight: '500' },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  body: { fontSize: 14, fontWeight: '400' },
} satisfies Record<string, TextStyle>;
