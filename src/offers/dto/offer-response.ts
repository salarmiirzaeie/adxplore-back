import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BrandCategory,
  CampaignStatus,
  DeliverableType,
  FollowerRange,
  OfferStatus,
} from '../../generated/prisma/client';

export class OfferPartyResponse {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  photoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  website!: string | null;

  @ApiPropertyOptional({ enum: BrandCategory, isArray: true })
  categories!: BrandCategory[];

  @ApiPropertyOptional({ nullable: true })
  city!: string | null;

  @ApiPropertyOptional({ nullable: true })
  province!: string | null;

  @ApiPropertyOptional({ enum: FollowerRange, nullable: true })
  followerRange!: FollowerRange | null;
}

export class OfferCampaignResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: DeliverableType })
  deliverable!: DeliverableType;

  @ApiProperty({ enum: DeliverableType, isArray: true })
  deliverables!: DeliverableType[];

  @ApiProperty({ enum: BrandCategory, isArray: true })
  categories!: BrandCategory[];

  @ApiProperty()
  city!: string;

  @ApiPropertyOptional({ nullable: true })
  province!: string | null;

  @ApiProperty({ enum: CampaignStatus })
  status!: CampaignStatus;

  @ApiProperty()
  brief!: string;

  @ApiPropertyOptional({ nullable: true })
  budgetMin!: number | null;

  @ApiPropertyOptional({ nullable: true })
  budgetMax!: number | null;
}

export class OfferResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  campaignId!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  influencerId!: string;

  @ApiProperty({ example: 8_000_000 })
  fee!: number;

  @ApiPropertyOptional({ nullable: true })
  message!: string | null;

  @ApiPropertyOptional({ nullable: true })
  deadline!: Date | null;

  @ApiProperty({ enum: OfferStatus })
  status!: OfferStatus;

  @ApiProperty({ type: OfferCampaignResponse })
  campaign!: OfferCampaignResponse;

  @ApiProperty({ type: OfferPartyResponse })
  brand!: OfferPartyResponse;

  @ApiProperty({ type: OfferPartyResponse })
  influencer!: OfferPartyResponse;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
