import type { Profile } from '../types/domain';

export type ProfileRow = {
  full_name: string; username: string; academic_stage: Profile['academicStage']; university: string;
  department: string; program: string; research_description: string; research_interests: string[];
  intents: string[]; current_city: string; current_country: string; show_current_location?: boolean;
  is_relocating: boolean; destination_city: string; destination_country: string; relocation_date: string;
  show_relocation_destination?: boolean; show_relocation_date?: boolean; languages: Profile['languages'];
  onboarding_completed: boolean;
};

type ProfileResultRow = Omit<ProfileRow, 'languages' | 'academic_stage'> & { languages: unknown; academic_stage: unknown };

function validAcademicStage(value: unknown): Profile['academicStage'] {
  const stages: Profile['academicStage'][] = ['', 'Final-year undergraduate', "Master's student", 'PhD student', 'Postdoc'];
  return stages.includes(value as Profile['academicStage']) ? value as Profile['academicStage'] : '';
}

function validLanguages(value: unknown): Profile['languages'] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Profile['languages'][number] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate.name === 'string' && typeof candidate.proficiency === 'string';
  }).map((language) => ({ name: language.name, proficiency: language.proficiency }));
}

export function rowToProfile(row: ProfileResultRow): Profile {
  return {
    fullName: row.full_name, username: row.username, academicStage: validAcademicStage(row.academic_stage),
    university: row.university, department: row.department, program: row.program,
    researchDescription: row.research_description, researchInterests: row.research_interests ?? [],
    intents: row.intents ?? [], currentCity: row.current_city, currentCountry: row.current_country,
    showCurrentLocation: Boolean(row.show_current_location), isRelocating: row.is_relocating,
    destinationCity: row.destination_city, destinationCountry: row.destination_country,
    relocationDate: row.relocation_date, showRelocationDestination: Boolean(row.show_relocation_destination),
    showRelocationDate: Boolean(row.show_relocation_date), languages: validLanguages(row.languages),
  };
}

export function profileToRow(profile: Profile, userId: string) {
  const boundedList = (items: string[], maxItems: number, maxLength: number) => items
    .map((item) => item.trim().slice(0, maxLength)).filter(Boolean).slice(0, maxItems);
  return {
    id: userId, full_name: profile.fullName.trim().slice(0, 100),
    username: profile.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30),
    academic_stage: profile.academicStage, university: profile.university.trim().slice(0, 160),
    department: profile.department.trim().slice(0, 120), program: profile.program.trim().slice(0, 160),
    research_description: profile.researchDescription.trim().slice(0, 3000),
    research_interests: boundedList(profile.researchInterests, 20, 60), intents: boundedList(profile.intents, 10, 80),
    current_city: profile.currentCity.trim().slice(0, 100), current_country: profile.currentCountry.trim().slice(0, 100),
    show_current_location: profile.showCurrentLocation, is_relocating: profile.isRelocating,
    destination_city: profile.isRelocating ? profile.destinationCity.trim().slice(0, 100) : '',
    destination_country: profile.isRelocating ? profile.destinationCountry.trim().slice(0, 100) : '',
    relocation_date: profile.isRelocating ? profile.relocationDate.trim().slice(0, 30) : '',
    show_relocation_destination: profile.isRelocating && profile.showRelocationDestination,
    show_relocation_date: profile.isRelocating && profile.showRelocationDate,
    languages: profile.languages.slice(0, 10).map((language) => ({
      name: language.name.trim().slice(0, 50), proficiency: language.proficiency.trim().slice(0, 30),
    })).filter((language) => language.name && language.proficiency), onboarding_completed: true,
  };
}
