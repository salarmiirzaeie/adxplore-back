import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { OfferStatus } from '../../generated/prisma/client';

const OFFER_STATUS_UPDATES = [
  OfferStatus.ACCEPTED,
  OfferStatus.REJECTED,
  OfferStatus.CANCELLED,
  OfferStatus.PENDING,
] as const;

export class UpdateOfferStatusDto {
  @ApiProperty({
    enum: OFFER_STATUS_UPDATES,
    example: OfferStatus.ACCEPTED,
    description:
      'Brand: ACCEPTED / REJECTED from PENDING; PENDING undoes a rejection; ACCEPTED is also allowed from REJECTED. Influencer: CANCELLED from PENDING.',
  })
  @IsIn(OFFER_STATUS_UPDATES)
  status!: (typeof OFFER_STATUS_UPDATES)[number];
}
