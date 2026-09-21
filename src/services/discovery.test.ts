import { describe, expect, it } from 'vitest';
import { toResearcher } from './discoveryMatching';
import type { Profile } from '../types/domain';

const profile = (changes: Partial<Profile> = {}): Profile => ({
  normalizationVersion: 1, fullName: 'Researcher', username: 'researcher', avatarPath: '', academicStage: 'PhD student',
  university: 'Istanbul Technical University', universityRorId: 'https://ror.org/059636586', universityCountryCode: 'TR',
  department: 'Planning', program: 'PhD', researchDescription: 'Research about sustainable urban mobility systems',
  researchInterests: ['Mobility'], intents: ['Collaborate'], currentCity: 'Istanbul', currentCountry: 'Türkiye',
  currentCityGeonamesId: '745044', currentCountryCode: 'TR', showCurrentLocation: true, isRelocating: false,
  destinationCity: '', destinationCountry: '', destinationCityGeonamesId: '', destinationCountryCode: '', relocationDate: '',
  showRelocationDestination: false, showRelocationDate: false, languages: [{ name: 'English', proficiency: 'Fluent' }], ...changes,
});

const candidate = (changes: Partial<Profile> = {}) => ({ ...profile({ fullName: 'Candidate', username: 'candidate', ...changes }), id: 'candidate-id' });

describe('normalized discovery matching', () => {
  it('matches different institution spellings through the same ROR identity', () => {
    const result = toResearcher(profile({ university: 'İTÜ' }), candidate({ university: 'Istanbul Technical University' }), 'research');
    expect(result?.reason).toContain('connected to Istanbul Technical University');
  });

  it('matches localized country labels through the ISO country code', () => {
    const viewer = profile({ isRelocating: true, destinationCity: 'Berlin', destinationCountry: 'Almanya', destinationCityGeonamesId: '2950159', destinationCountryCode: 'DE' });
    const result = toResearcher(viewer, candidate({ currentCity: 'Berlin', currentCountry: 'Germany', currentCityGeonamesId: '2950159', currentCountryCode: 'DE' }), 'moving');
    expect(result?.reason).toContain('already based in Berlin');
  });

  it('does not treat different normalized city identities as the same city', () => {
    const viewer = profile({ isRelocating: true, destinationCity: 'Springfield', destinationCountry: 'United States', destinationCityGeonamesId: '1', destinationCountryCode: 'US' });
    const result = toResearcher(viewer, candidate({ currentCity: 'Springfield', currentCountry: 'United States', currentCityGeonamesId: '2', currentCountryCode: 'US' }), 'moving');
    expect(result?.reason).not.toContain('already based');
  });

  it('keeps legacy text matching when normalized identities are missing', () => {
    const viewer = profile({ normalizationVersion: 0, currentCityGeonamesId: '', currentCountryCode: '' });
    const result = toResearcher(viewer, candidate({ normalizationVersion: 0, currentCityGeonamesId: '', currentCountryCode: '' }), 'moving');
    expect(result).not.toBeNull();
  });
});
