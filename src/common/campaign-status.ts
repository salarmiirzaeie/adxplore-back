import { CampaignStatus } from '../generated/prisma/client';

export function isCampaignInExplore(status: CampaignStatus) {
  return status === CampaignStatus.OPEN;
}

export function canBrandInvite(status: CampaignStatus) {
  return (
    status === CampaignStatus.OPEN ||
    status === CampaignStatus.PENDING_REVIEW
  );
}

/**
 * Brands cannot put a campaign in Explore. Requesting OPEN (or
 * PENDING_REVIEW) queues it for admin review, unless it is already live.
 */
export function resolveBrandStatus(
  requested: CampaignStatus | undefined,
  current?: CampaignStatus,
): CampaignStatus {
  if (requested == null) {
    return current ?? CampaignStatus.DRAFT;
  }
  if (requested === CampaignStatus.CLOSED) {
    return CampaignStatus.CLOSED;
  }
  if (requested === CampaignStatus.DRAFT) {
    return CampaignStatus.DRAFT;
  }
  if (current === CampaignStatus.OPEN) {
    return CampaignStatus.OPEN;
  }
  return CampaignStatus.PENDING_REVIEW;
}
