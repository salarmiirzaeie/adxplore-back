import { ForbiddenException } from '@nestjs/common';
import {
  InfluencerApprovalStatus,
  UserRole,
  type User,
} from '../generated/prisma/client';
import { parseCategories } from './categories';

export const INFLUENCER_NOT_APPROVED = 'INFLUENCER_NOT_APPROVED';

export function isInfluencerProfileComplete(user: User): boolean {
  const categories = parseCategories(user.categories, user.category);
  return Boolean(
    user.role === UserRole.INFLUENCER &&
    user.name?.trim() &&
    user.website?.trim() &&
    user.city?.trim() &&
    user.province?.trim() &&
    categories.length &&
    user.followerRange,
  );
}

/** Browse the panel after follow + DM. Sending offers still needs admin approval. */
export function influencerCanAccessPanel(user: User): boolean {
  if (user.role !== UserRole.INFLUENCER) return true;
  if (!isInfluencerProfileComplete(user)) return false;
  if (user.approvalStatus === InfluencerApprovalStatus.APPROVED) return true;
  return Boolean(user.instagramDmMarkedSentAt);
}

export function influencerCanSendOffers(user: User): boolean {
  if (user.role !== UserRole.INFLUENCER) return true;
  return user.approvalStatus === InfluencerApprovalStatus.APPROVED;
}

export type InfluencerNextScreen =
  'ONBOARDING' | 'INSTAGRAM_APPROVAL' | 'PANEL';

export function influencerNextScreen(user: User): InfluencerNextScreen {
  if (user.role !== UserRole.INFLUENCER) return 'PANEL';
  if (!isInfluencerProfileComplete(user)) return 'ONBOARDING';
  if (user.approvalStatus === InfluencerApprovalStatus.APPROVED) return 'PANEL';
  if (user.instagramDmMarkedSentAt) return 'PANEL';
  return 'INSTAGRAM_APPROVAL';
}

export const OFFER_WAIT_FOR_ADMIN_MESSAGE =
  'منتظر تأیید ادمین بمانید. پس از بررسی فالو و دایرکت می‌توانید پیشنهاد بفرستید.';

export function assertInfluencerApproved(user: User) {
  if (user.role !== UserRole.INFLUENCER) return;
  if (user.approvalStatus === InfluencerApprovalStatus.APPROVED) return;

  throw new ForbiddenException({
    code: INFLUENCER_NOT_APPROVED,
    approvalStatus: user.approvalStatus ?? InfluencerApprovalStatus.PENDING,
    nextScreen: influencerNextScreen(user),
    message:
      user.approvalStatus === InfluencerApprovalStatus.REJECTED
        ? 'درخواست عضویت شما رد شده است. پیج را فالو کنید، کد را دایرکت بفرستید و منتظر بررسی دوباره بمانید.'
        : OFFER_WAIT_FOR_ADMIN_MESSAGE,
  });
}
