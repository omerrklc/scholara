export type AcademicStage = 'Final-year undergraduate' | "Master's student" | 'PhD student' | 'Postdoc';
export type DiscoveryMode = 'research' | 'moving';

export type Language = { name: string; proficiency: string };

export type Profile = {
  fullName: string;
  username: string;
  academicStage: AcademicStage | '';
  university: string;
  department: string;
  program: string;
  researchDescription: string;
  researchInterests: string[];
  intents: string[];
  currentCity: string;
  currentCountry: string;
  isRelocating: boolean;
  destinationCity: string;
  destinationCountry: string;
  relocationDate: string;
  languages: Language[];
};

export type Researcher = {
  id: string;
  initials: string;
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

export type CommunityPost = {
  id: string;
  author: string;
  context: string;
  body: string;
  community: string;
  replies: number;
  helpful: number;
};
