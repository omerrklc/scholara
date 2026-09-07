import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import type { Profile } from '@/types/domain';

const initialProfile: Profile = {
  fullName: 'Alex Morgan', username: 'alexmorgan', academicStage: '', university: '', department: '', program: '',
  researchDescription: '', researchInterests: [], intents: [], currentCity: '', currentCountry: '',
  isRelocating: false, destinationCity: '', destinationCountry: '', relocationDate: '',
  languages: [{ name: 'English', proficiency: 'Fluent' }],
};

type AppState = {
  profile: Profile;
  onboardingComplete: boolean;
  saved: string[];
  connected: string[];
  updateProfile: (next: Profile) => void;
  completeOnboarding: (next: Profile) => void;
  toggleSaved: (id: string) => void;
  connect: (id: string) => void;
};

const AppContext = createContext<AppState | null>(null);
const STORAGE_KEY = 'scholara.phase1.state';

export function AppProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState(initialProfile);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [connected, setConnected] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const data = JSON.parse(raw) as Partial<{ profile: Profile; onboardingComplete: boolean; saved: string[]; connected: string[] }>;
        if (data.profile) setProfile(data.profile);
        if (data.onboardingComplete) setOnboardingComplete(true);
        if (data.saved) setSaved(data.saved);
        if (data.connected) setConnected(data.connected);
      } catch {
        // Ignore malformed local prototype data and start cleanly.
      }
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, onboardingComplete, saved, connected }));
  }, [profile, onboardingComplete, saved, connected]);

  const value = useMemo<AppState>(() => ({
    profile, onboardingComplete, saved, connected,
    updateProfile: setProfile,
    completeOnboarding: (next) => { setProfile(next); setOnboardingComplete(true); },
    toggleSaved: (id) => setSaved((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]),
    connect: (id) => setConnected((items) => items.includes(id) ? items : [...items, id]),
  }), [profile, onboardingComplete, saved, connected]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
