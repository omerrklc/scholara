import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { colors, type ResolvedTheme, setActiveTheme } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';
type ThemeState = { colors: typeof colors; preference: ThemePreference; resolvedTheme: ResolvedTheme; setPreference: (preference: ThemePreference) => Promise<void> };
const storageKey = 'scholara.theme-preference';
const ThemeContext = createContext<ThemeState | null>(null);
const isPreference = (value: string | null): value is ThemePreference => value === 'system' || value === 'light' || value === 'dark';

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemTheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const resolvedTheme: ResolvedTheme = preference === 'system' ? systemTheme : preference;
  setActiveTheme(resolvedTheme);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then((stored) => { if (active && isPreference(stored)) setPreferenceState(stored); });
    return () => { active = false; };
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    await AsyncStorage.setItem(storageKey, next);
  }, []);
  const value = useMemo(() => ({ colors, preference, resolvedTheme, setPreference }), [preference, resolvedTheme, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
