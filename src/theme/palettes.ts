export const lightColors = {
  background: '#F6F7F4', surface: '#FFFFFF', surfaceMuted: '#ECF2EF', ink: '#16241F', inkMuted: '#65716C',
  primary: '#146B55', primaryDark: '#0A4A3A', primarySoft: '#DDEDE7', accent: '#D9A441', border: '#DDE4E0', danger: '#B64A4A', white: '#FFFFFF',
  placeholder: '#8C9691', selectedBorder: '#A8CFC1', errorSurface: '#FBECEC', errorBorder: '#E8B9B9',
  infoSurface: '#EDF2F7', infoBorder: '#C9D5E1', warmSurface: '#F7F1E4', warmBorder: '#E8D8B4', warmText: '#8D651B', rail: '#C8D8D2', inactive: '#7B8681',
} as const;

export type ThemeColors = { [Key in keyof typeof lightColors]: string };
export type ResolvedTheme = 'light' | 'dark';

export const darkColors: ThemeColors = {
  background: '#0E1512', surface: '#17211D', surfaceMuted: '#202D28', ink: '#F0F6F3', inkMuted: '#A8B7B0',
  primary: '#2E9475', primaryDark: '#8BDCC0', primarySoft: '#193D32', accent: '#E0B85B', border: '#31423A', danger: '#E47A7A', white: '#FFFFFF',
  placeholder: '#82928B', selectedBorder: '#3E806B', errorSurface: '#3B2022', errorBorder: '#724044',
  infoSurface: '#202D35', infoBorder: '#3B5360', warmSurface: '#352D1F', warmBorder: '#655433', warmText: '#F0C66E', rail: '#40554C', inactive: '#87958F',
};
