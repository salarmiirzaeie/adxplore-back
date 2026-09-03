import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BrandCategory,
  BrandGoal,
  BusinessSize,
  CampaignStatus,
  DeliverableType,
} from '../../generated/prisma/client';

export class CampaignImageResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  sortOrder!: number;
}

export class CampaignBrandResponse {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  photoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  website!: string | null;

  @ApiPropertyOptional({ nullable: true })
  bio!: string | null;

  @ApiPropertyOptional({ enum: BrandCategory, nullable: true })
  category!: BrandCategory | null;

  @ApiProperty({ enum: BrandCategory, isArray: true })
  categories!: BrandCategory[];

  @ApiPropertyOptional({ nullable: true })
  city!: string | null;

  @ApiPropertyOptional({ nullable: true })
  province!: string | null;

  @ApiPropertyOptional({ enum: BrandGoal, nullable: true })
  goal!: BrandGoal | null;

  @ApiPropertyOptional({ enum: BusinessSize, nullable: true })
  businessSize!: BusinessSize | null;
}

export class CampaignResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty({ type: CampaignBrandResponse })
  brand!: CampaignBrandResponse;

  @ApiProperty({ example: 'لانچ محصول تابستانی' })
  title!: string;

  @ApiProperty()
  brief!: string;

  @ApiProperty({ enum: BrandCategory })
  category!: BrandCategory;

  @ApiProperty({ enum: BrandCategory, isArray: true })
  categories!: BrandCategory[];

  @ApiProperty({ example: 'کرج' })
  city!: string;

  @ApiPropertyOptional({ example: 'البرز', nullable: true })
  province!: string | null;

  @ApiProperty({ enum: DeliverableType })
  deliverable!: DeliverableType;

  @ApiProperty({ enum: DeliverableType, isArray: true })
  deliverables!: DeliverableType[];

  @ApiPropertyOptional({ nullable: true, example: 5_000_000 })
  budgetMin!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 15_000_000 })
  budgetMax!: number | null;

  @ApiProperty({ enum: CampaignStatus })
  status!: CampaignStatus;

  @ApiPropertyOptional({ nullable: true })
  rejectionReason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  rejectedAt!: Date | null;

  @ApiProperty({ type: CampaignImageResponse, isArray: true })
  images!: CampaignImageResponse[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
