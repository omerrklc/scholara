export const colors = {
  background: '#F6F7F4',
  surface: '#FFFFFF',
  surfaceMuted: '#ECF2EF',
  ink: '#16241F',
  inkMuted: '#65716C',
  primary: '#146B55',
  primaryDark: '#0A4A3A',
  primarySoft: '#DDEDE7',
  accent: '#D9A441',
  border: '#DDE4E0',
  danger: '#B64A4A',
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const shadow = {
  shadowColor: '#0B2B21',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 3,
} as const;
