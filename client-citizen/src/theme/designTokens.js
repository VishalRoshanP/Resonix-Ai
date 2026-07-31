// Resonix AI Design Tokens — Exported from Stitch Design System
// These mirror the Tailwind theme but are available for JS-level usage

export const colors = {
  primary: '#23211F',
  primaryContainer: '#23211f',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#8c8885',
  inversePrimary: '#cbc5c2',

  secondary: '#C66A1A',
  secondaryContainer: '#C66A1A',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#6c3400',

  tertiary: '#0b0a0b',
  tertiaryContainer: '#222122',
  onTertiary: '#ffffff',

  surface: '#fdf8f7',
  surfaceDim: '#ddd9d8',
  surfaceContainer: '#f1edec',
  surfaceContainerLow: '#f7f3f2',
  surfaceContainerHigh: '#ebe7e6',
  surfaceContainerHighest: '#e6e2e1',
  surfaceContainerLowest: '#ffffff',
  surfaceVariant: '#e6e2e1',
  onSurface: '#1c1b1b',
  onSurfaceVariant: '#4b4640',
  inverseSurface: '#313030',
  inverseOnSurface: '#f4f0ef',

  background: '#F7F5F2',
  onBackground: '#1c1b1b',

  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  outline: '#7d766f',
  outlineVariant: '#cec5bd',

  success: '#4CAF50',
  forestGreen: '#2E7D32',
  deepCrimson: '#C62828',
};

export const typography = {
  displayLg: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '48px',
    lineHeight: '56px',
    letterSpacing: '-0.02em',
    fontWeight: 700,
  },
  headlineLg: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '32px',
    lineHeight: '40px',
    fontWeight: 700,
  },
  headlineLgMobile: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: 700,
  },
  headlineMd: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: 600,
  },
  bodyLg: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '18px',
    lineHeight: '28px',
    fontWeight: 400,
  },
  bodyMd: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 400,
  },
  labelSm: {
    fontFamily: "'Inter', sans-serif",
    fontSize: '12px',
    lineHeight: '16px',
    letterSpacing: '0.05em',
    fontWeight: 500,
  },
  monoData: {
    fontFamily: "'Inter', monospace",
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 450,
  },
};

export const spacing = {
  unit: '4px',
  gutterMobile: '16px',
  gutterDesktop: '24px',
  marginMobile: '16px',
  marginDesktop: '64px',
  containerMax: '1280px',
};

export const borderRadius = {
  sm: '0.125rem',
  default: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  full: '9999px',
};

export const shadows = {
  ambient: '0px 8px 16px rgba(35, 33, 31, 0.08)',
  nav: '0 -4px 16px rgba(0, 0, 0, 0.05)',
};
