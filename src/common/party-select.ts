import { audienceProofSelect } from './audience-proof';

/** Shared Prisma select for brand/influencer party cards on invitations & offers. */
export const partySelect = {
  id: true,
  name: true,
  photoUrl: true,
  website: true,
  bio: true,
  category: true,
  categories: true,
  city: true,
  province: true,
  followerRange: true,
  audienceProofs: {
    select: audienceProofSelect,
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;

/** Brand snippet on campaign browse / detail for influencer profile pages. */
export const campaignBrandSelect = {
  id: true,
  name: true,
  photoUrl: true,
  website: true,
  bio: true,
  category: true,
  categories: true,
  city: true,
  province: true,
  goal: true,
  businessSize: true,
} as const;

/** Campaign snippet used on invitations (fuller) and offers. */
export const invitationCampaignSelect = {
  id: true,
  title: true,
  deliverable: true,
  deliverables: true,
  category: true,
  categories: true,
  city: true,
  province: true,
  status: true,
  brief: true,
  budgetMin: true,
  budgetMax: true,
} as const;

export const offerCampaignSelect = {
  id: true,
  title: true,
  deliverable: true,
  deliverables: true,
  category: true,
  categories: true,
  city: true,
  province: true,
  status: true,
  brief: true,
  budgetMin: true,
  budgetMax: true,
} as const;

/** Campaign snippet used on deals (same shape as offers). */
export const dealCampaignSelect = offerCampaignSelect;
