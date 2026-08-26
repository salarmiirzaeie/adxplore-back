import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BrandCategory,
  CampaignStatus,
  DealStatus,
  DeliverableType,
  FollowerRange,
} from '../../generated/prisma/client';

export class DealPartyResponse {
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

  @ApiPropertyOptional({ enum: FollowerRange, nullable: true })
  followerRange!: FollowerRange | null;
}

export class DealCampaignResponse {
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

export class DealResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  offerId!: string;

  @ApiProperty()
  campaignId!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  influencerId!: string;

  @ApiProperty({ example: 8_000_000 })
  fee!: number;

  @ApiProperty({ enum: DealStatus })
  status!: DealStatus;

  @ApiPropertyOptional({ nullable: true })
  contentUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ nullable: true })
  proofUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brandFeedback!: string | null;

  @ApiPropertyOptional({ nullable: true })
  submittedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: DealCampaignResponse })
  campaign!: DealCampaignResponse;

  @ApiProperty({ type: DealPartyResponse })
  brand!: DealPartyResponse;

  @ApiProperty({ type: DealPartyResponse })
  influencer!: DealPartyResponse;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
