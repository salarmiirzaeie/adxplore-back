import { BrandCategory } from '../generated/prisma/client';
import {
  parseDeliverables,
  primaryDeliverable,
} from './deliverables';

const ALL = new Set<string>(Object.values(BrandCategory));

export function parseCategories(
  value: unknown,
  fallback?: BrandCategory | null,
): BrandCategory[] {
  if (Array.isArray(value)) {
    const list = value.filter(
      (v): v is BrandCategory => typeof v === 'string' && ALL.has(v),
    );
    if (list.length) return [...new Set(list)];
  }
  if (typeof value === 'string') {
    try {
      return parseCategories(JSON.parse(value), fallback);
    } catch {
      /* ignore */
    }
  }
  if (fallback) return [fallback];
  return [];
}

export function normalizeCategories(
  input: BrandCategory[] | undefined | null,
): BrandCategory[] {
  if (!input?.length) return [];
  return [...new Set(input.filter((v) => ALL.has(v)))];
}

export function primaryCategory(
  categories: BrandCategory[],
): BrandCategory | null {
  return categories[0] ?? null;
}

export function mapPartyCategories<
  T extends {
    category?: BrandCategory | null;
    categories: unknown;
  },
>(party: T) {
  const categories = parseCategories(party.categories, party.category);
  return {
    ...party,
    category: primaryCategory(categories) ?? party.category ?? null,
    categories,
  };
}

export function mapCampaignCategories<
  T extends {
    category?: BrandCategory | null;
    categories: unknown;
    deliverable?: string | null;
    deliverables?: unknown;
  },
>(campaign: T) {
  const categories = parseCategories(campaign.categories, campaign.category);
  const deliverables = parseDeliverables(
    campaign.deliverables,
    campaign.deliverable,
  );
  return {
    ...campaign,
    category: primaryCategory(categories) ?? campaign.category!,
    categories,
    deliverable: primaryDeliverable(deliverables) ?? campaign.deliverable!,
    deliverables,
  };
}
