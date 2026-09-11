import { describe, expect, it } from 'vitest';
import { rowToProfile } from './profileMapping';

const baseRow = {
  full_name: 'Ada Researcher', username: 'ada_researcher', academic_stage: 'PhD student',
  university: 'Example University', department: 'Planning', program: 'PhD',
  research_description: 'Research description', research_interests: ['Mobility'], intents: ['Collaborate'],
  current_city: 'Istanbul', current_country: 'Türkiye', show_current_location: false,
  is_relocating: false, destination_city: '', destination_country: '', relocation_date: '',
  show_relocation_destination: false, show_relocation_date: false, onboarding_completed: true,
};

describe('profile database boundary', () => {
  it('keeps only well-formed language values', () => {
    const profile = rowToProfile({ ...baseRow, languages: [
      { name: 'English', proficiency: 'Fluent' }, { name: 'Broken' }, 'Turkish', null,
    ] });
    expect(profile.languages).toEqual([{ name: 'English', proficiency: 'Fluent' }]);
  });

  it('falls back safely for an unknown academic stage', () => {
    expect(rowToProfile({ ...baseRow, academic_stage: 'Administrator', languages: [] }).academicStage).toBe('');
  });
});
