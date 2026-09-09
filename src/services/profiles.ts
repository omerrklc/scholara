import type { Profile } from '@/types/domain';
import { supabase } from '@/services/supabase';

export type ProfileRow = {
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
  const boundedList = (items: string[], maxItems: number, maxLength: number) => items
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);

  return {
    id: userId,
    full_name: profile.fullName.trim().slice(0, 100),
    username: profile.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30),
    academic_stage: profile.academicStage,
    university: profile.university.trim().slice(0, 160),
    department: profile.department.trim().slice(0, 120),
    program: profile.program.trim().slice(0, 160),
    research_description: profile.researchDescription.trim().slice(0, 3000),
    research_interests: boundedList(profile.researchInterests, 20, 60),
    intents: boundedList(profile.intents, 10, 80),
    current_city: profile.currentCity.trim().slice(0, 100),
    current_country: profile.currentCountry.trim().slice(0, 100),
    is_relocating: profile.isRelocating,
    destination_city: profile.isRelocating ? profile.destinationCity.trim().slice(0, 100) : '',
    destination_country: profile.isRelocating ? profile.destinationCountry.trim().slice(0, 100) : '',
    relocation_date: profile.isRelocating ? profile.relocationDate.trim().slice(0, 30) : '',
    languages: profile.languages.slice(0, 10).map((language) => ({
      name: language.name.trim().slice(0, 50),
      proficiency: language.proficiency.trim().slice(0, 30),
    })).filter((language) => language.name && language.proficiency),
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
