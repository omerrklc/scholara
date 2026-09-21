import type { Session } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { AppState as NativeAppState, Platform } from 'react-native';
import { fetchDiscoveryActions, requestConnection, setSavedProfile, type ConnectionState } from '@/services/connections';
import { fetchProfile, saveProfile } from '@/services/profiles';
import { fetchUnreadNotificationCount, subscribeToNotificationInserts } from '@/services/notifications';
import { syncPushRegistration, unregisterCurrentPushDevice, type PushRegistrationState } from '@/services/pushNotifications';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import type { Profile } from '@/types/domain';

const initialProfile: Profile = {
  fullName: '', username: '', avatarPath: '', academicStage: '', university: '', department: '', program: '',
  researchDescription: '', researchInterests: [], intents: [], currentCity: '', currentCountry: '', showCurrentLocation: false,
  isRelocating: false, destinationCity: '', destinationCountry: '', relocationDate: '', showRelocationDestination: false, showRelocationDate: false,
  languages: [{ name: 'English', proficiency: 'Fluent' }],
};

type AppState = {
  profile: Profile;
  onboardingComplete: boolean;
  saved: string[];
  connectionStates: Record<string, ConnectionState>;
  session: Session | null;
  authReady: boolean;
  profileLoading: boolean;
  unreadNotifications: number;
  pushRegistrationState: PushRegistrationState;
  isSupabaseConfigured: boolean;
  updateProfile: (next: Profile) => void;
  completeOnboarding: (next: Profile) => Promise<string | null>;
  toggleSaved: (id: string) => Promise<string | null>;
  connect: (id: string) => Promise<{ state: ConnectionState | null; error: string | null }>;
  refreshActions: () => Promise<string | null>;
  refreshNotifications: () => Promise<void>;
  enablePushNotifications: () => Promise<PushRegistrationState>;
  signOut: () => Promise<string | null>;
};

const AppContext = createContext<AppState | null>(null);

function profileFromSession(session: Session): Profile {
  const fullName = typeof session.user.user_metadata.full_name === 'string' ? session.user.user_metadata.full_name : '';
  return { ...initialProfile, fullName, username: `user_${session.user.id.replace(/-/g, '').slice(0, 24)}` };
}

export function AppProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState(initialProfile);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>({});
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [profileLoading, setProfileLoading] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pushRegistrationState, setPushRegistrationState] = useState<PushRegistrationState>('idle');

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const applySession = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        setProfile(initialProfile);
        setOnboardingComplete(false);
        setSaved([]);
        setConnectionStates({});
        setUnreadNotifications(0);
        setPushRegistrationState('idle');
        setProfileLoading(false);
        setAuthReady(true);
        return;
      }

      setProfileLoading(true);
      setProfile(profileFromSession(nextSession));
      const [result, actions, unreadCount] = await Promise.all([
        fetchProfile(nextSession.user.id),
        fetchDiscoveryActions(nextSession.user.id),
        fetchUnreadNotificationCount(),
      ]);
      if (!active) return;
      if (result.profile) setProfile(result.profile);
      setOnboardingComplete(result.completed);
      setSaved(actions.saved);
      setConnectionStates(actions.connectionStates);
      setUnreadNotifications(unreadCount);
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

  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;
    const unsubscribe = subscribeToNotificationInserts(session.user.id, () => {
      void fetchUnreadNotificationCount().then((count) => {
        if (active) setUnreadNotifications(count);
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id || !onboardingComplete) return;
    let active = true;
    void syncPushRegistration(false).then((state) => {
      if (active) setPushRegistrationState(state);
    });
    return () => { active = false; };
  }, [onboardingComplete, session?.user.id]);

  const value = useMemo<AppState>(() => ({
    profile, onboardingComplete, saved, connectionStates, session, authReady, profileLoading, unreadNotifications, pushRegistrationState, isSupabaseConfigured,
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
    toggleSaved: async (id) => {
      if (!session) return 'You need to sign in first.';
      const shouldSave = !saved.includes(id);
      const error = await setSavedProfile(session.user.id, id, shouldSave);
      if (!error) setSaved((items) => shouldSave ? [...items, id] : items.filter((item) => item !== id));
      return error;
    },
    connect: async (id) => {
      if (!session) return { state: null, error: 'You need to sign in first.' };
      const result = await requestConnection(id);
      if (result.state) setConnectionStates((current) => ({ ...current, [id]: result.state }));
      return result;
    },
    refreshActions: async () => {
      if (!session) return 'You need to sign in first.';
      const result = await fetchDiscoveryActions(session.user.id);
      if (!result.error) {
        setSaved(result.saved);
        setConnectionStates(result.connectionStates);
      }
      return result.error;
    },
    refreshNotifications: async () => {
      if (!session) {
        setUnreadNotifications(0);
        return;
      }
      setUnreadNotifications(await fetchUnreadNotificationCount());
    },
    enablePushNotifications: async () => {
      setPushRegistrationState('registering');
      const state = await syncPushRegistration(true);
      setPushRegistrationState(state);
      return state;
    },
    signOut: async () => {
      if (!supabase) return 'Supabase is not configured.';
      await unregisterCurrentPushDevice();
      const { error } = await supabase.auth.signOut();
      return error?.message ?? null;
    },
  }), [profile, onboardingComplete, saved, connectionStates, session, authReady, profileLoading, unreadNotifications, pushRegistrationState]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
