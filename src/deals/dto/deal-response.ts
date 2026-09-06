import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BrandCategory,
  CampaignStatus,
  DealContentKind,
  DealStatus,
  DeliverableType,
  FollowerRange,
} from '../../generated/prisma/client';
import { AudienceProofResponse } from '../../users/dto/audience-proof-response';

export class DealPartyResponse {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  photoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  website!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'تولیدکننده محتوای زیبایی و لایف‌استایل.',
  })
  bio!: string | null;

  @ApiPropertyOptional({ enum: BrandCategory, isArray: true })
  categories!: BrandCategory[];

  @ApiPropertyOptional({ nullable: true })
  city!: string | null;

  @ApiPropertyOptional({ nullable: true })
  province!: string | null;

  @ApiPropertyOptional({ enum: FollowerRange, nullable: true })
  followerRange!: FollowerRange | null;

  @ApiProperty({ type: AudienceProofResponse, isArray: true })
  audienceProofs!: AudienceProofResponse[];
}

export class DealCampaignResponse {
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

  @ApiPropertyOptional({
    nullable: true,
    description: 'User id of the party who cancelled. Null when the deal is not cancelled.',
  })
  cancelledById!: string | null;

  @ApiProperty({
    description:
      'True when the current user cancelled this deal and may re-enable it with status IN_PROGRESS.',
  })
  canReactivate!: boolean;

  @ApiPropertyOptional({ enum: DealContentKind, nullable: true })
  contentKind!: DealContentKind | null;

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
