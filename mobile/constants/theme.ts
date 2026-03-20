import { DarkTheme, type Theme } from '@react-navigation/native';

export const premiumPalette = {
  background: '#050509',
  surface: '#10101A',
  surfaceElevated: '#171725',
  border: 'rgba(226, 232, 240, 0.18)',
  borderSoft: 'rgba(226, 232, 240, 0.11)',
  glass: 'rgba(16, 16, 26, 0.66)',
  glassHeavy: 'rgba(12, 12, 20, 0.78)',
  textPrimary: '#E2E8F0',
  textSecondary: '#94A3B8',
  accent: '#00E5FF',
  accentStrong: '#00CFE8',
  indigo: '#4F46E5',
  gold: '#FBBF24',
  warning: '#EF4444',
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
