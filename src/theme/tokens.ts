import { StyleSheet } from 'react-native';
import { darkColors, lightColors, type ResolvedTheme, type ThemeColors } from './palettes';
export { darkColors, lightColors, type ResolvedTheme, type ThemeColors } from './palettes';

let activeColors: ThemeColors = lightColors;
let activeTheme: ResolvedTheme = 'light';
let themeVersion = 0;

export const colors = new Proxy({} as ThemeColors, { get: (_target, property: keyof ThemeColors) => activeColors[property] });

export function setActiveTheme(next: ResolvedTheme) {
  if (activeTheme === next) return;
  activeTheme = next;
  activeColors = next === 'dark' ? darkColors : lightColors;
  themeVersion += 1;
}

export function createThemedStyleSheet<T extends StyleSheet.NamedStyles<T>>(factory: () => T & StyleSheet.NamedStyles<T>): T {
  let cachedVersion = -1;
  let cached: T;
  return new Proxy({} as T, { get: (_target, property: string) => {
    if (cachedVersion !== themeVersion) { cached = StyleSheet.create(factory()) as T; cachedVersion = themeVersion; }
    return cached[property as keyof T];
  } });
}

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

const lightShadow = { shadowColor: '#0B2B21', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 3 } as const;
const darkShadow = { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 3 } as const;
export const shadow = new Proxy({} as typeof lightShadow, { get: (_target, property: keyof typeof lightShadow) => (activeTheme === 'dark' ? darkShadow : lightShadow)[property] });
