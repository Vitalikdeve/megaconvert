export const themeModes = ['dark', 'light', 'system'] as const;

export type ThemeMode = (typeof themeModes)[number];
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

export const designTokens = {
  color: {
    dark: {
      accent: '#5d8cff',
      accentSoft: 'rgba(93, 140, 255, 0.16)',
      canvas: '#08111a',
      canvasAlt: '#0f1928',
      danger: '#ff7a7a',
      highlight: '#7ef0d0',
      ink: '#eff4ff',
      inkMuted: '#9eabc2',
      inkSubtle: '#748099',
      panel: 'rgba(12, 18, 30, 0.82)',
      shadow: '0 32px 80px rgba(2, 6, 14, 0.42)',
      surface: 'rgba(14, 21, 33, 0.72)',
      surfaceRaised: 'rgba(18, 27, 42, 0.9)',
      surfaceStrong: '#152034',
      success: '#4fd7a2',
      warning: '#f4bf6f',
    },
    light: {
      accent: '#315fff',
      accentSoft: 'rgba(49, 95, 255, 0.12)',
      canvas: '#f4efe8',
      canvasAlt: '#ebe2d6',
      danger: '#d25555',
      highlight: '#0f8d84',
      ink: '#101827',
      inkMuted: '#5d6673',
      inkSubtle: '#7f8794',
      panel: 'rgba(247, 243, 237, 0.88)',
      shadow: '0 28px 72px rgba(25, 33, 47, 0.14)',
      surface: 'rgba(255, 255, 255, 0.82)',
      surfaceRaised: 'rgba(255, 255, 255, 0.96)',
      surfaceStrong: '#ffffff',
      success: '#137f69',
      warning: '#a76d31',
    },
  },
  motion: {
    duration: {
      fast: 0.18,
      normal: 0.28,
      slow: 0.44,
    },
    easing: {
      emphasized: [0.22, 1, 0.36, 1] as const,
      standard: [0.2, 0.8, 0.2, 1] as const,
    },
    distance: {
      cardEnter: 18,
      subtle: 10,
    },
  },
  radius: {
    lg: '2rem',
    md: '1.375rem',
    pill: '999px',
    sm: '1rem',
    xl: '2.5rem',
  },
  shadow: {
    focus: '0 0 0 3px rgba(49, 95, 255, 0.18)',
    soft: '0 18px 48px rgba(19, 27, 38, 0.12)',
  },
  spacing: {
    lg: '1.5rem',
    md: '1rem',
    sm: '0.75rem',
    xl: '2rem',
    xs: '0.5rem',
    xxl: '3rem',
  },
  typography: {
    displayTracking: '-0.055em',
    monoScale: '0.82rem',
    uiScale: '0.96rem',
  },
} as const;

export const foundationTheme = designTokens;
