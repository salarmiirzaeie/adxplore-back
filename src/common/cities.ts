import { BadRequestException } from '@nestjs/common';
import { getCity, getProvince } from '@code-plate/iran-cities';
import type { Prisma } from '../generated/prisma/client';

export const NATIONWIDE_CITY = 'کل ایران';

export type ResolvedLocation = {
  city: string;
  province: string | null;
};

function trimOrEmpty(value?: string | null) {
  return value?.trim() ?? '';
}

export function isNationwideCity(city?: string | null) {
  return trimOrEmpty(city) === NATIONWIDE_CITY;
}

export function resolveProfileLocation(
  city?: string | null,
  province?: string | null,
): ResolvedLocation {
  const nextCity = trimOrEmpty(city);
  const nextProvince = trimOrEmpty(province);

  if (!nextCity) {
    throw new BadRequestException('شهر را انتخاب کنید');
  }
  if (!nextProvince) {
    throw new BadRequestException('استان را انتخاب کنید');
  }

  const provinceRecord = getProvince(nextProvince);
  if (!provinceRecord) {
    throw new BadRequestException('استان نامعتبر است');
  }

  const cityRecord = getCity(nextCity, nextProvince);
  if (!cityRecord) {
    throw new BadRequestException('شهر با این استان مطابقت ندارد');
  }

  return { city: cityRecord.fa, province: provinceRecord.fa };
}

export function resolveCampaignLocation(
  city?: string | null,
  province?: string | null,
): ResolvedLocation {
  if (isNationwideCity(city)) {
    if (trimOrEmpty(province)) {
      throw new BadRequestException('کمپین سراسری نباید استان داشته باشد');
    }
    return { city: NATIONWIDE_CITY, province: null };
  }
  return resolveProfileLocation(city, province);
}

export function campaignLocationWhere(opts: {
  city?: string | null;
  province?: string | null;
}): Prisma.CampaignWhereInput | undefined {
  const city = trimOrEmpty(opts.city) || undefined;
  const province = trimOrEmpty(opts.province) || undefined;
  if (!city && !province) return undefined;
  if (city === NATIONWIDE_CITY) {
    return { city: NATIONWIDE_CITY };
  }
  const match: Prisma.CampaignWhereInput = {};
  if (city) match.city = city;
  if (province) match.province = province;
  return {
    OR: [match, { city: NATIONWIDE_CITY }],
  };
}
