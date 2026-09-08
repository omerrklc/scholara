import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { AppState as NativeAppState, Platform } from 'react-native';
import { fetchProfile, saveProfile } from '@/services/profiles';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import type { Profile } from '@/types/domain';

const initialProfile: Profile = {
  fullName: '', username: '', academicStage: '', university: '', department: '', program: '',
  researchDescription: '', researchInterests: [], intents: [], currentCity: '', currentCountry: '',
  isRelocating: false, destinationCity: '', destinationCountry: '', relocationDate: '',
  languages: [{ name: 'English', proficiency: 'Fluent' }],
};

type AppState = {
  profile: Profile;
  onboardingComplete: boolean;
  saved: string[];
  connected: string[];
  session: Session | null;
  authReady: boolean;
  profileLoading: boolean;
  isSupabaseConfigured: boolean;
  updateProfile: (next: Profile) => void;
  completeOnboarding: (next: Profile) => Promise<string | null>;
  toggleSaved: (id: string) => void;
  connect: (id: string) => void;
  signOut: () => Promise<string | null>;
};

const AppContext = createContext<AppState | null>(null);
const LOCAL_STATE_KEY = 'scholara.phase2.local-state';

function profileFromSession(session: Session): Profile {
  const fullName = typeof session.user.user_metadata.full_name === 'string' ? session.user.user_metadata.full_name : '';
  return { ...initialProfile, fullName, username: `user_${session.user.id.replace(/-/g, '').slice(0, 24)}` };
}

export function AppProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState(initialProfile);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [connected, setConnected] = useState<string[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LOCAL_STATE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const data = JSON.parse(raw) as Partial<{ saved: string[]; connected: string[] }>;
        if (data.saved) setSaved(data.saved);
        if (data.connected) setConnected(data.connected);
      } catch {
        // Ignore malformed non-sensitive prototype preferences.
      }
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(LOCAL_STATE_KEY, JSON.stringify({ saved, connected }));
  }, [saved, connected]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const applySession = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        setProfile(initialProfile);
        setOnboardingComplete(false);
        setProfileLoading(false);
        setAuthReady(true);
        return;
      }

      setProfileLoading(true);
      setProfile(profileFromSession(nextSession));
      const result = await fetchProfile(nextSession.user.id);
      if (!active) return;
      if (result.profile) setProfile(result.profile);
      setOnboardingComplete(result.completed);
      setProfileLoading(false);
      setAuthReady(true);
    };

    void supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || Platform.OS === 'web') return;
    const client = supabase;

    if (NativeAppState.currentState === 'active') client.auth.startAutoRefresh();
    const listener = NativeAppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });

    return () => {
      listener.remove();
      client.auth.stopAutoRefresh();
    };
  }, []);

  const value = useMemo<AppState>(() => ({
    profile, onboardingComplete, saved, connected, session, authReady, profileLoading, isSupabaseConfigured,
    updateProfile: setProfile,
    completeOnboarding: async (next) => {
      if (!session) return 'You need to sign in before saving your profile.';
      const error = await saveProfile(next, session.user.id);
      if (!error) {
        setProfile(next);
        setOnboardingComplete(true);
      }
      return error;
    },
    toggleSaved: (id) => setSaved((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]),
    connect: (id) => setConnected((items) => items.includes(id) ? items : [...items, id]),
    signOut: async () => {
      if (!supabase) return 'Supabase is not configured.';
      const { error } = await supabase.auth.signOut();
      return error?.message ?? null;
    },
  }), [profile, onboardingComplete, saved, connected, session, authReady, profileLoading]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
