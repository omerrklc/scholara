export type AcademicStage = 'Final-year undergraduate' | "Master's student" | 'PhD student' | 'Postdoc';
export type DiscoveryMode = 'research' | 'moving';

export type Language = { name: string; proficiency: string };

export type Profile = {
  fullName: string;
  username: string;
  avatarPath: string;
  academicStage: AcademicStage | '';
  university: string;
  department: string;
  program: string;
  researchDescription: string;
  researchInterests: string[];
  intents: string[];
  currentCity: string;
  currentCountry: string;
  showCurrentLocation: boolean;
  isRelocating: boolean;
  destinationCity: string;
  destinationCountry: string;
  relocationDate: string;
  showRelocationDestination: boolean;
  showRelocationDate: boolean;
  languages: Language[];
};

export type Researcher = {
  id: string;
  initials: string;
  avatarUrl?: string;
  name: string;
  stage: string;
  university: string;
  location: string;
  destination?: string;
  arrival?: string;
  tags: string[];
  research: string;
  intent: string;
  score: number;
  reason: string;
  color: string;
};
