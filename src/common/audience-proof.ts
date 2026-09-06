export const AUDIENCE_PROOF_MAX_IMAGES = 8;

export const audienceProofSelect = {
  id: true,
  url: true,
  sortOrder: true,
} as const;

export type AudienceProofCard = {
  id: string;
  url: string;
  sortOrder: number;
};

export function mapAudienceProofs(
  proofs: AudienceProofCard[] | undefined | null,
): AudienceProofCard[] {
  if (!proofs?.length) return [];
  return [...proofs]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({ id: p.id, url: p.url, sortOrder: p.sortOrder }));
}
