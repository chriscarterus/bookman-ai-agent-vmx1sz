import { createTheme as createMuiTheme, Theme, ThemeOptions } from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';
import { PaletteOptions } from '@mui/material/styles/createPalette';

// Import CSS variable references (these files are referenced but not directly imported)
// @see '../styles/themes.css'
// @see '../styles/variables.css'

// Theme mode type definition
export type ThemeMode = 'light' | 'dark';

// Global theme mode constants
export const THEME_LIGHT = 'light' as const;
export const THEME_DARK = 'dark' as const;

// Typography configuration
const typography: TypographyOptions = {
  fontFamily: [
    'Roboto',
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Arial',
    'sans-serif',
  ].join(','),
  h1: {
    fontSize: '32px',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  h2: {
    fontSize: '28px',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  h3: {
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  body1: {
    fontSize: '16px',
    lineHeight: 1.5,
  },
  body2: {
    fontSize: '14px',
    lineHeight: 1.5,
  },
  caption: {
    fontSize: '12px',
    lineHeight: 1.5,
  },
  button: {
    textTransform: 'none',
    fontWeight: 500,
  },
};

// Color palette configuration
const createPalette = (mode: ThemeMode): PaletteOptions => ({
  mode,
  primary: {
    main: '#2563EB',
    light: '#60A5FA',
    dark: '#1E40AF',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#10B981',
    light: '#34D399',
    dark: '#059669',
    contrastText: '#FFFFFF',
  },
  error: {
    main: '#EF4444',
    light: '#F87171',
    dark: '#B91C1C',
    contrastText: '#FFFFFF',
  },
  warning: {
    main: '#F59E0B',
    light: '#FBBF24',
    dark: '#D97706',
    contrastText: '#FFFFFF',
  },
  info: {
    main: '#3B82F6',
    light: '#60A5FA',
    dark: '#2563EB',
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#10B981',
    light: '#34D399',
    dark: '#059669',
    contrastText: '#FFFFFF',
  },
  background: {
    default: mode === 'light' ? '#FFFFFF' : '#121212',
    paper: mode === 'light' ? '#F9FAFB' : '#1E1E1E',
  },
  text: {
    primary: mode === 'light' ? '#111827' : '#F9FAFB',
    secondary: mode === 'light' ? '#4B5563' : '#9CA3AF',
  },
});

// Spacing configuration
const spacing = {
  base: 4,
  get: (multiplier: number) => `${multiplier * 4}px`,
};

// Breakpoints configuration
const breakpoints = {
  values: {
    xs: 320,
    sm: 768,
    md: 1024,
    lg: 1440,
    xl: 1920,
  },
};

// Shadow configuration
const shadows = [
  'none',
  '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  // ... additional shadow definitions
];

// Transition configuration
const transitions = {
  short: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  medium: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  long: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
};

// Theme creation function
export const createTheme = (mode: ThemeMode): Theme => {
  const themeOptions: ThemeOptions = {
    palette: createPalette(mode),
    typography,
    spacing: spacing.base,
    breakpoints,
    shadows,
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: '8px',
            padding: '8px 16px',
            transition: transitions.medium,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: '12px',
            transition: transitions.medium,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '16px',
            transition: transitions.medium,
          },
        },
      },
    },
  };

  return createMuiTheme(themeOptions);
};

// Theme tokens getter
export const getThemeTokens = (mode: ThemeMode) => ({
  mode,
  ...createPalette(mode),
  typography,
  spacing,
  breakpoints,
  shadows,
  transitions,
});

// Default theme export
export const theme = createTheme(THEME_LIGHT);

// Type augmentation for custom theme properties
declare module '@mui/material/styles' {
  interface Theme {
    transitions: typeof transitions;
  }
  interface ThemeOptions {
    transitions?: typeof transitions;
  }
}