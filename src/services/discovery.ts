import { supabase } from '@/services/supabase';
import { rowToProfile, type ProfileRow } from '@/services/profiles';
import type { DiscoveryMode, Profile, Researcher } from '@/types/domain';

type DiscoveryProfile = Profile & { id: string };
type DiscoveryProfileRow = ProfileRow & { id: string };

const profileColumns = [
  'id', 'full_name', 'username', 'academic_stage', 'university', 'department', 'program',
  'research_description', 'research_interests', 'intents', 'current_city', 'current_country',
  'is_relocating', 'destination_city', 'destination_country', 'relocation_date', 'languages',
  'onboarding_completed',
].join(',');

const avatarColors = ['#C97B63', '#5F8796', '#7C6D9B', '#486D62', '#A66C86', '#5C7C99'];
const stopWords = new Set(['about', 'after', 'also', 'and', 'are', 'for', 'from', 'how', 'into', 'its', 'our', 'that', 'the', 'their', 'this', 'through', 'using', 'with', 'your']);

const normalize = (value: string) => value.trim().toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const same = (left: string, right: string) => Boolean(left && right && normalize(left) === normalize(right));
const sharedValues = (left: string[], right: string[]) => left.filter((value) => right.some((candidate) => same(value, candidate)));
const words = (value: string) => new Set(normalize(value).split(/[^a-z0-9çğıöşü]+/).filter((word) => word.length > 3 && !stopWords.has(word)));

function sharedResearchTerms(viewer: Profile, candidate: Profile) {
  const viewerWords = words(`${viewer.researchDescription} ${viewer.department} ${viewer.program}`);
  return [...words(`${candidate.researchDescription} ${candidate.department} ${candidate.program}`)]
    .filter((word) => viewerWords.has(word))
    .slice(0, 3);
}

function initials(name: string) {
  const result = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase()).join('');
  return result || 'R';
}

function colorFor(id: string) {
  const hash = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

function researchMatch(viewer: Profile, candidate: Profile) {
  const interests = sharedValues(viewer.researchInterests, candidate.researchInterests);
  const intents = sharedValues(viewer.intents, candidate.intents);
  const terms = sharedResearchTerms(viewer, candidate);
  const departmentMatch = same(viewer.department, candidate.department);
  const score = Math.min(98, 42 + Math.min(interests.length, 3) * 12 + Math.min(intents.length, 2) * 5 + Math.min(terms.length, 3) * 4 + (departmentMatch ? 6 : 0));

  const reasons: string[] = [];
  if (interests.length) reasons.push(`Shared interests: ${interests.slice(0, 3).join(', ')}`);
  if (departmentMatch) reasons.push(`You both work in ${candidate.department}`);
  if (terms.length) reasons.push(`Related research themes: ${terms.join(', ')}`);
  if (!reasons.length) reasons.push('Your completed academic profiles provide useful complementary perspectives');
  return { score, reason: `${reasons.slice(0, 2).join('. ')}.` };
}

function movingMatch(viewer: Profile, candidate: Profile) {
  const targetCity = viewer.isRelocating ? viewer.destinationCity : viewer.currentCity;
  const targetCountry = viewer.isRelocating ? viewer.destinationCountry : viewer.currentCountry;
  const candidateIsThere = same(candidate.currentCity, targetCity) && same(candidate.currentCountry, targetCountry);
  const candidateGoingThere = candidate.isRelocating && same(candidate.destinationCity, targetCity) && same(candidate.destinationCountry, targetCountry);
  const sameCountry = same(candidate.currentCountry, targetCountry) || (candidate.isRelocating && same(candidate.destinationCountry, targetCountry));
  const samePeriod = Boolean(viewer.relocationDate && candidate.relocationDate && same(viewer.relocationDate, candidate.relocationDate));
  const research = researchMatch(viewer, candidate);
  const relevant = candidateIsThere || candidateGoingThere || sameCountry;
  const score = Math.min(98, 35 + (candidateIsThere ? 45 : 0) + (candidateGoingThere ? 35 : 0) + (!candidateIsThere && !candidateGoingThere && sameCountry ? 20 : 0) + (samePeriod ? 8 : 0) + Math.round((research.score - 42) / 4));

  let reason = `You are both connected to ${targetCountry || 'the same academic destination'}.`;
  if (candidateIsThere) reason = `${candidate.fullName} is already based in ${targetCity}, ${targetCountry}.`;
  else if (candidateGoingThere) reason = `You are both planning a move to ${targetCity}, ${targetCountry}${samePeriod ? ' around the same time' : ''}.`;
  return { relevant, score, reason };
}

function toResearcher(viewer: Profile, candidate: DiscoveryProfile, mode: DiscoveryMode): Researcher | null {
  const match = mode === 'moving' ? movingMatch(viewer, candidate) : { ...researchMatch(viewer, candidate), relevant: true };
  if (!match.relevant) return null;

  return {
    id: candidate.id,
    initials: initials(candidate.fullName),
    name: candidate.fullName || candidate.username,
    stage: candidate.academicStage || 'Researcher',
    university: candidate.university || candidate.department,
    location: [candidate.currentCity, candidate.currentCountry].filter(Boolean).join(', '),
    destination: candidate.isRelocating ? [candidate.destinationCity, candidate.destinationCountry].filter(Boolean).join(', ') : undefined,
    arrival: candidate.isRelocating ? candidate.relocationDate || undefined : undefined,
    tags: candidate.researchInterests.slice(0, 5),
    research: candidate.researchDescription,
    intent: candidate.intents.slice(0, 3).join(' · ') || 'Academic networking',
    score: match.score,
    reason: match.reason,
    color: colorFor(candidate.id),
  };
}

export function rankResearchers(viewer: Profile, profiles: DiscoveryProfile[], mode: DiscoveryMode) {
  return profiles
    .map((candidate) => toResearcher(viewer, candidate, mode))
    .filter((candidate): candidate is Researcher => Boolean(candidate))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
}

export async function fetchDiscoveryProfiles(currentUserId: string) {
  if (!supabase) return { profiles: [] as DiscoveryProfile[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('profiles')
    .select(profileColumns)
    .eq('onboarding_completed', true)
    .neq('id', currentUserId)
    .limit(50);

  if (error) return { profiles: [] as DiscoveryProfile[], error: error.message };
  const profiles = (data as unknown as DiscoveryProfileRow[]).map((row) => ({ id: row.id, ...rowToProfile(row) }));
  return { profiles, error: null };
}
