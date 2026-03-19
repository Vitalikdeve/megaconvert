import { DarkTheme, type Theme } from '@react-navigation/native';

export const premiumPalette = {
  background: '#060B14',
  surface: '#0D1526',
  surfaceElevated: '#121D33',
  border: '#1D2B45',
  textPrimary: '#EFF3FA',
  textSecondary: '#9EACBF',
  accent: '#2D8CFF',
  accentStrong: '#1870E4',
  success: '#38D19A',
} as const;

export const premiumDarkTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: premiumPalette.accent,
    background: premiumPalette.background,
    card: premiumPalette.surface,
    text: premiumPalette.textPrimary,
    border: premiumPalette.border,
    notification: premiumPalette.accentStrong,
  },
};
