import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BrandCategory,
  CampaignStatus,
  DeliverableType,
  InvitationStatus,
} from '../../generated/prisma/client';
import { OfferPartyResponse } from '../../offers/dto/offer-response';

export class InvitationCampaignResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: DeliverableType })
  deliverable!: DeliverableType;

  @ApiProperty({ enum: BrandCategory, isArray: true })
  categories!: BrandCategory[];

  @ApiProperty()
  city!: string;

  @ApiProperty({ enum: CampaignStatus })
  status!: CampaignStatus;

  @ApiProperty()
  brief!: string;

  @ApiPropertyOptional({ nullable: true })
  budgetMin!: number | null;

  @ApiPropertyOptional({ nullable: true })
  budgetMax!: number | null;
}

export class InvitationResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  campaignId!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  influencerId!: string;

  @ApiPropertyOptional({ nullable: true })
  message!: string | null;

  @ApiProperty({ enum: InvitationStatus })
  status!: InvitationStatus;

  @ApiProperty({ type: InvitationCampaignResponse })
  campaign!: InvitationCampaignResponse;

  @ApiProperty({ type: OfferPartyResponse })
  brand!: OfferPartyResponse;

  @ApiProperty({ type: OfferPartyResponse })
  influencer!: OfferPartyResponse;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
