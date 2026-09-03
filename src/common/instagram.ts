import { randomBytes } from 'crypto';
import type { User } from '../generated/prisma/client';
import {
  influencerCanAccessPanel,
  influencerCanSendOffers,
  isInfluencerProfileComplete,
} from './influencer-approval';

export const DEFAULT_INSTAGRAM_PAGE_USERNAME = 'adxplore.ir';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInstagramVerifyCode(): string {
  const bytes = randomBytes(5);
  let body = '';
  for (const byte of bytes) {
    body += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `ADX-${body}`;
}

export function parseInstagramHandle(
  website: string | null | undefined,
): string | null {
  if (!website?.trim()) return null;
  const raw = website.trim();
  const withoutAt = raw.replace(/^@/, '');
  try {
    const withProtocol = /^https?:\/\//i.test(withoutAt)
      ? withoutAt
      : `https://${withoutAt}`;
    const url = new URL(withProtocol);
    if (
      /instagram\.com$/i.test(url.hostname) ||
      /instagr\.am$/i.test(url.hostname)
    ) {
      const handle = url.pathname.split('/').filter(Boolean)[0];
      return handle ? decodeURIComponent(handle).replace(/^@/, '') : null;
    }
  } catch {
    /* not a URL */
  }
  const handle = withoutAt.split(/[/?#\s]/)[0];
  return handle || null;
}

export function instagramPageLinks(username: string) {
  const handle = username.replace(/^@/, '');
  const profileUrl = `https://www.instagram.com/${handle}/`;
  const dmUrl = `https://ig.me/m/${handle}`;
  return {
    username: handle,
    profileUrl,
    followUrl: profileUrl,
    dmUrl,
    appProfileUrl: `instagram://user?username=${handle}`,
    /** ig.me is an Instagram universal link and opens the DM thread. */
    appDmUrl: dmUrl,
    androidProfileIntent: `intent://instagram.com/_u/${handle}#Intent;scheme=https;package=com.instagram.android;S.browser_fallback_url=${encodeURIComponent(profileUrl)};end`,
    androidDmIntent: `intent://ig.me/m/${handle}#Intent;scheme=https;package=com.instagram.android;S.browser_fallback_url=${encodeURIComponent(dmUrl)};end`,
  };
}

export function buildDmMessage(opts: {
  verifyCode: string;
  influencerHandle?: string | null;
  influencerName?: string | null;
}): string {
  const lines = [
    'سلام، درخواست عضویت در ادکسپلور',
    `کد تأیید: ${opts.verifyCode}`,
  ];
  if (opts.influencerHandle) {
    lines.push(`اینستاگرام من: @${opts.influencerHandle}`);
  } else if (opts.influencerName?.trim()) {
    lines.push(`نام: ${opts.influencerName.trim()}`);
  }
  return lines.join('\n');
}

export type InstagramApprovalUiStatus =
  'ONBOARDING' | 'ACTION_REQUIRED' | 'WAITING_REVIEW' | 'APPROVED' | 'REJECTED';

export function instagramUiStatus(user: User): InstagramApprovalUiStatus {
  if (!isInfluencerProfileComplete(user)) return 'ONBOARDING';
  if (user.approvalStatus === 'APPROVED') return 'APPROVED';
  if (user.approvalStatus === 'REJECTED') return 'REJECTED';
  if (user.instagramDmMarkedSentAt) return 'WAITING_REVIEW';
  return 'ACTION_REQUIRED';
}

export function buildInstagramApprovalPayload(opts: {
  user: User;
  pageUsername: string;
}) {
  const { user, pageUsername } = opts;
  const page = instagramPageLinks(pageUsername);
  const verifyCode = user.instagramVerifyCode;
  const influencerHandle = parseInstagramHandle(user.website);
  const dmMessage = verifyCode
    ? buildDmMessage({
        verifyCode,
        influencerHandle,
        influencerName: user.name,
      })
    : null;
  const uiStatus = instagramUiStatus(user);
  const approvalStatus = user.approvalStatus ?? null;

  const copy = {
    headline:
      uiStatus === 'APPROVED'
        ? 'حساب شما تأیید شد'
        : uiStatus === 'REJECTED'
          ? 'درخواست عضویت رد شد'
          : uiStatus === 'WAITING_REVIEW'
            ? 'منتظر تأیید ما بمانید'
            : uiStatus === 'ONBOARDING'
              ? 'ابتدا پروفایل را کامل کنید'
              : 'برای ورود به پنل، پیج را فالو کنید و کد را دایرکت بفرستید',
    subtitle:
      uiStatus === 'APPROVED'
        ? 'حساب تأیید شد. می‌توانید کمپین‌ها را ببینید و پیشنهاد بفرستید.'
        : uiStatus === 'REJECTED'
          ? user.rejectionReason?.trim() ||
            'پیج @adxplore.ir را فالو کنید، همان کد را دوباره دایرکت بفرستید و منتظر بررسی بمانید.'
          : uiStatus === 'WAITING_REVIEW'
            ? 'می‌توانید وارد پنل شوید و کمپین‌ها را ببینید. ارسال پیشنهاد بعد از تأیید ادمین فعال می‌شود.'
            : uiStatus === 'ONBOARDING'
              ? 'پس از تکمیل پروفایل، یک کد برای دایرکت اینستاگرام می‌گیرید.'
              : `پیج @${page.username} را فالو کنید، پیام زیر را کپی کنید و در دایرکت بفرستید. بعد از آن وارد پنل می‌شوید.`,
    waitingHint:
      uiStatus === 'WAITING_REVIEW'
        ? 'ارسال پیشنهاد تا تأیید ادمین ممکن نیست.'
        : 'پس از ارسال دایرکت، دکمه «پیام را فرستادم» را بزنید تا وارد پنل شوید.',
  };

  return {
    approvalStatus,
    uiStatus,
    onboardingComplete: isInfluencerProfileComplete(user),
    canAccessPanel: influencerCanAccessPanel(user),
    canSendOffers: influencerCanSendOffers(user),
    verifyCode,
    dmMessage,
    influencerInstagram: influencerHandle,
    rejectionReason: user.rejectionReason,
    markedSentAt: user.instagramDmMarkedSentAt,
    approvedAt: user.approvedAt,
    pollIntervalSeconds: 15,
    page,
    copy,
    actions: {
      copyMessage: dmMessage
        ? { label: 'کپی پیام دایرکت', text: dmMessage }
        : null,
      copyCode: verifyCode ? { label: 'کپی کد', text: verifyCode } : null,
      follow: {
        label: `فالو کردن @${page.username}`,
        url: page.followUrl,
        appUrl: page.appProfileUrl,
        androidIntent: page.androidProfileIntent,
      },
      openDm: {
        label: 'باز کردن دایرکت',
        url: page.dmUrl,
        appUrl: page.appDmUrl,
        androidIntent: page.androidDmIntent,
      },
      confirmSent: {
        label: 'پیام را فرستادم',
        enabled: Boolean(
          verifyCode &&
          (uiStatus === 'ACTION_REQUIRED' || uiStatus === 'REJECTED'),
        ),
      },
    },
    steps: [
      {
        id: 'follow',
        title: `پیج @${page.username} را فالو کنید`,
        body: 'فالو کردن پیج ادکسپلور برای تأیید حساب لازم است.',
        action: 'OPEN_FOLLOW',
        done: uiStatus === 'WAITING_REVIEW' || uiStatus === 'APPROVED',
      },
      {
        id: 'copy',
        title: 'پیام تأیید را کپی کنید',
        body:
          dmMessage ??
          'پس از تکمیل پروفایل، پیام آماده کپی اینجا نشان داده می‌شود.',
        action: 'COPY_MESSAGE',
        done: Boolean(dmMessage),
      },
      {
        id: 'dm',
        title: 'دایرکت را باز کنید و پیام را بفرستید',
        body: 'اینستاگرام پیام را از قبل پر نمی‌کند؛ پیام کپی‌شده را در دایرکت پیست کنید.',
        action: 'OPEN_DM',
        done: uiStatus === 'WAITING_REVIEW' || uiStatus === 'APPROVED',
      },
      {
        id: 'wait',
        title: 'منتظر تأیید بمانید',
        body: 'پس از بررسی فالو و دایرکت، پنل برای شما باز می‌شود.',
        action: 'WAIT',
        done: uiStatus === 'APPROVED',
      },
    ],
  };
}
