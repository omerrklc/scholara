import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import tr from 'i18n-iso-countries/langs/tr.json';
import { supabase } from '@/services/supabase';

countries.registerLocale(en);
countries.registerLocale(tr);

export type CountryOption = { code: string; name: string };
export type InstitutionOption = {
  id: string; name: string; countryCode: string; countryName: string; city: string; types: string[]; source: 'ror';
};
export type CityOption = {
  id: string; name: string; admin1: string; countryCode: string; countryName: string; label: string; source: 'geonames';
};

export function getCountryOptions(locale: 'en' | 'tr' = 'en'): CountryOption[] {
  return Object.entries(countries.getNames(locale, { select: 'official' }))
    .map(([code, name]) => ({ code, name }))
    .sort((left, right) => left.name.localeCompare(right.name, locale));
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function institution(value: unknown): InstitutionOption | null {
  const item = record(value);
  if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.countryCode !== 'string') return null;
  return {
    id: item.id, name: item.name, countryCode: item.countryCode,
    countryName: typeof item.countryName === 'string' ? item.countryName : '',
    city: typeof item.city === 'string' ? item.city : '',
    types: Array.isArray(item.types) ? item.types.filter((type): type is string => typeof type === 'string') : [],
    source: 'ror',
  };
}

function city(value: unknown): CityOption | null {
  const item = record(value);
  if (!item || typeof item.id !== 'string' || !/^\d+$/.test(item.id) || typeof item.name !== 'string' || typeof item.countryCode !== 'string') return null;
  const countryName = typeof item.countryName === 'string' ? item.countryName : '';
  const admin1 = typeof item.admin1 === 'string' ? item.admin1 : '';
  return {
    id: item.id, name: item.name, admin1, countryCode: item.countryCode, countryName,
    label: typeof item.label === 'string' ? item.label : [item.name, admin1, countryName].filter(Boolean).join(', '),
    source: 'geonames',
  };
}

async function search<T>(body: Record<string, string>, parse: (value: unknown) => T | null) {
  if (!supabase) return { results: [] as T[], error: 'Scholara is not connected to its server.' };
  const { data, error } = await supabase.functions.invoke('search-reference-data', { body });
  if (error) return { results: [] as T[], error: 'Search is temporarily unavailable. Please try again.' };
  const root = record(data);
  const values = Array.isArray(root?.results) ? root.results : [];
  return { results: values.map(parse).filter((item): item is T => Boolean(item)), error: null };
}

export function searchInstitutions(query: string, countryCode?: string) {
  return search({ type: 'institutions', query, ...(countryCode ? { countryCode } : {}), language: 'en' }, institution);
}

export function searchCities(query: string, countryCode: string) {
  return search({ type: 'cities', query, countryCode, language: 'en' }, city);
}
