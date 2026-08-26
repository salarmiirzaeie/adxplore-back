import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { OfferStatus } from '../../generated/prisma/client';

const OFFER_STATUS_UPDATES = [
  OfferStatus.ACCEPTED,
  OfferStatus.REJECTED,
  OfferStatus.CANCELLED,
] as const;

export class UpdateOfferStatusDto {
  @ApiProperty({
    enum: OFFER_STATUS_UPDATES,
    example: OfferStatus.ACCEPTED,
  })
  @IsIn(OFFER_STATUS_UPDATES)
  status!: (typeof OFFER_STATUS_UPDATES)[number];
}
