import { DeliverableType } from '../generated/prisma/client';

const ALL = new Set<string>(Object.values(DeliverableType));

export function parseDeliverables(
  value: unknown,
  fallback?: string | null,
): DeliverableType[] {
  if (Array.isArray(value)) {
    const list = value.filter(
      (v): v is DeliverableType => typeof v === 'string' && ALL.has(v),
    );
    if (list.length) return [...new Set(list)];
  }
  if (typeof value === 'string') {
    try {
      return parseDeliverables(JSON.parse(value), fallback);
    } catch {
      /* ignore */
    }
  }
  if (fallback && ALL.has(fallback)) return [fallback as DeliverableType];
  return [];
}

export function normalizeDeliverables(
  input: DeliverableType[] | undefined | null,
): DeliverableType[] {
  if (!input?.length) return [];
  return [...new Set(input.filter((v) => ALL.has(v)))];
}

export function primaryDeliverable(
  deliverables: DeliverableType[],
): DeliverableType | null {
  return deliverables[0] ?? null;
}
