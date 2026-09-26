import { ForbiddenException } from '@nestjs/common';
import {
  InfluencerApprovalStatus,
  UserRole,
  type User,
} from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { parseCategories } from './categories';

export const INFLUENCER_NOT_APPROVED = 'INFLUENCER_NOT_APPROVED';

/**
 * Temporary launch switches. Unset or `false` opens signup:
 * influencers skip follow + DM and are stored as approved.
 * Set both to `true` on the server to require the full review again.
 */
function readEnvFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return defaultValue;
  const value = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return defaultValue;
}

/** Follow @adxplore.ir and DM the verify code before the panel opens. */
export function isInstagramVerificationEnabled(): boolean {
  return readEnvFlag('INFLUENCER_INSTAGRAM_VERIFICATION_ENABLED', false);
}

/** Admin must approve before the influencer can send offers or be discovered. */
export function isInfluencerAdminApprovalRequired(): boolean {
  return readEnvFlag('INFLUENCER_ADMIN_APPROVAL_REQUIRED', false);
}

/**
 * Brand panel: browse the influencer directory and invite them to campaigns.
 * Unset or `false` hides both until you turn this on.
 */
export function isBrandInfluencerDiscoveryEnabled(): boolean {
  return readEnvFlag('BRAND_INFLUENCER_DISCOVERY_ENABLED', false);
}

export const BRAND_INFLUENCER_DISCOVERY_DISABLED =
  'کشف بلاگر و ارسال دعوت موقتاً غیرفعال است.';

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

/** Browse the panel after follow + DM, unless Instagram verification is turned off. */
export function influencerCanAccessPanel(user: User): boolean {
  if (user.role !== UserRole.INFLUENCER) return true;
  if (!isInfluencerProfileComplete(user)) return false;
  if (!isInstagramVerificationEnabled()) return true;
  if (user.approvalStatus === InfluencerApprovalStatus.APPROVED) return true;
  return Boolean(user.instagramDmMarkedSentAt);
}

export function influencerCanSendOffers(user: User): boolean {
  if (user.role !== UserRole.INFLUENCER) return true;
  if (user.approvalStatus === InfluencerApprovalStatus.APPROVED) return true;
  if (!isInfluencerProfileComplete(user)) return false;
  if (isInfluencerAdminApprovalRequired()) return false;
  if (isInstagramVerificationEnabled() && !user.instagramDmMarkedSentAt) {
    return false;
  }
  return true;
}

/** Write APPROVED when the launch flags say this influencer should already be live. */
export function shouldAutoApproveInfluencer(user: User): boolean {
  if (user.role !== UserRole.INFLUENCER) return false;
  if (user.approvalStatus === InfluencerApprovalStatus.APPROVED) return false;
  return influencerCanSendOffers(user);
}

export async function syncInfluencerLaunchApproval(
  prisma: PrismaService,
  user: User,
): Promise<User> {
  if (!shouldAutoApproveInfluencer(user)) return user;
  return prisma.user.update({
    where: { id: user.id },
    data: {
      approvalStatus: InfluencerApprovalStatus.APPROVED,
      approvedAt: new Date(),
      rejectedAt: null,
      rejectionReason: null,
    },
  });
}

export type InfluencerNextScreen =
  'ONBOARDING' | 'INSTAGRAM_APPROVAL' | 'PANEL';

export function influencerNextScreen(user: User): InfluencerNextScreen {
  if (user.role !== UserRole.INFLUENCER) return 'PANEL';
  if (!isInfluencerProfileComplete(user)) return 'ONBOARDING';
  if (!isInstagramVerificationEnabled()) return 'PANEL';
  if (user.approvalStatus === InfluencerApprovalStatus.APPROVED) return 'PANEL';
  if (user.instagramDmMarkedSentAt) return 'PANEL';
  return 'INSTAGRAM_APPROVAL';
}

export const OFFER_WAIT_FOR_ADMIN_MESSAGE =
  'منتظر تأیید ادمین بمانید. پس از بررسی فالو و دایرکت می‌توانید پیشنهاد بفرستید.';

export function assertInfluencerApproved(user: User) {
  if (influencerCanSendOffers(user)) return;

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
