export const normalizeCommunityPost = (value: string) => value.trim().slice(0, 2000);
export const normalizeCommunityComment = (value: string) => value.trim().slice(0, 1000);
