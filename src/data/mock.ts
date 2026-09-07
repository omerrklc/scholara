import type { CommunityPost, Researcher } from '@/types/domain';

export const researchers: Researcher[] = [
  {
    id: 'luca', initials: 'LB', name: 'Luca Bianchi', stage: 'PhD Candidate',
    university: 'Politecnico di Milano', location: 'Milan, Italy',
    tags: ['Urban Mobility', 'GIS', 'Transport Planning'],
    research: 'Studying how pedestrianisation and micromobility reshape access in historic European city centres.',
    intent: 'Research discussion · Collaboration', score: 87,
    reason: 'You both study pedestrian-oriented urban environments and use spatial analysis.', color: '#C97B63',
  },
  {
    id: 'amina', initials: 'AK', name: 'Amina Khalil', stage: "Master's Student",
    university: 'TU Delft', location: 'Delft, Netherlands', destination: 'Stockholm, Sweden', arrival: 'September 2027',
    tags: ['Climate Adaptation', 'Urban Design', 'Resilience'],
    research: 'Exploring heat-resilient public spaces and climate adaptation strategies for dense neighbourhoods.',
    intent: 'Moving abroad · Peer support', score: 82,
    reason: 'Your work overlaps in sustainable cities, and you are relocating during the same academic term.', color: '#5F8796',
  },
  {
    id: 'maya', initials: 'MS', name: 'Maya Singh', stage: 'Postdoctoral Researcher',
    university: 'KTH Royal Institute of Technology', location: 'Stockholm, Sweden', destination: 'Stockholm, Sweden',
    tags: ['Mobility Justice', 'Accessibility', 'Mixed Methods'],
    research: 'Researching equitable access to low-carbon transport for underserved urban communities.',
    intent: 'Mentoring · Research collaboration', score: 91,
    reason: 'Your mobility topics are complementary, and Maya already works in your destination city.', color: '#7C6D9B',
  },
];

export const posts: CommunityPost[] = [
  { id: '1', author: 'Elena Rossi', context: 'PhD · University of Bologna', community: 'PhD in Europe', body: 'Has anyone recently completed a cotutelle agreement between two EU universities? I would love to compare timelines.', replies: 12, helpful: 38 },
  { id: '2', author: 'Noah Williams', context: 'MSc · UCL', community: 'Urban Planning', body: 'Looking for open datasets on pedestrian flows in historic centres. Which cities have the most usable portals?', replies: 8, helpful: 24 },
  { id: '3', author: 'Zeynep Aydın', context: 'PhD · KTH', community: 'Moving to Stockholm', body: 'I made a short checklist for personnummer, housing queues, and student transport. Happy to share it with new arrivals.', replies: 19, helpful: 61 },
];
