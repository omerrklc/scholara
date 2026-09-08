import type { Profile } from '@/types/domain';
import { supabase } from '@/services/supabase';

type ProfileRow = {
  full_name: string;
  username: string;
  academic_stage: Profile['academicStage'];
  university: string;
  department: string;
  program: string;
  research_description: string;
  research_interests: string[];
  intents: string[];
  current_city: string;
  current_country: string;
  is_relocating: boolean;
  destination_city: string;
  destination_country: string;
  relocation_date: string;
  languages: Profile['languages'];
  onboarding_completed: boolean;
};

export function rowToProfile(row: ProfileRow): Profile {
  return {
    fullName: row.full_name,
    username: row.username,
    academicStage: row.academic_stage,
    university: row.university,
    department: row.department,
    program: row.program,
    researchDescription: row.research_description,
    researchInterests: row.research_interests ?? [],
    intents: row.intents ?? [],
    currentCity: row.current_city,
    currentCountry: row.current_country,
    isRelocating: row.is_relocating,
    destinationCity: row.destination_city,
    destinationCountry: row.destination_country,
    relocationDate: row.relocation_date,
    languages: Array.isArray(row.languages) ? row.languages : [],
  };
}

export function profileToRow(profile: Profile, userId: string) {
  return {
    id: userId,
    full_name: profile.fullName.trim().slice(0, 100),
    username: profile.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30),
    academic_stage: profile.academicStage,
    university: profile.university.trim(),
    department: profile.department.trim(),
    program: profile.program.trim(),
    research_description: profile.researchDescription.trim().slice(0, 3000),
    research_interests: profile.researchInterests,
    intents: profile.intents,
    current_city: profile.currentCity.trim(),
    current_country: profile.currentCountry.trim(),
    is_relocating: profile.isRelocating,
    destination_city: profile.isRelocating ? profile.destinationCity.trim() : '',
    destination_country: profile.isRelocating ? profile.destinationCountry.trim() : '',
    relocation_date: profile.isRelocating ? profile.relocationDate.trim() : '',
    languages: profile.languages,
    onboarding_completed: true,
  };
}

export async function fetchProfile(userId: string) {
  if (!supabase) return { profile: null, completed: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return { profile: null, completed: false, error: error.message };
  if (!data) return { profile: null, completed: false, error: null };
  const row = data as ProfileRow;
  return { profile: rowToProfile(row), completed: row.onboarding_completed, error: null };
}

export async function saveProfile(profile: Profile, userId: string) {
  if (!supabase) return 'Supabase is not configured.';
  const { error } = await supabase.from('profiles').upsert(profileToRow(profile, userId), { onConflict: 'id' });
  return error?.message ?? null;
}
