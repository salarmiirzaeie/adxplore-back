import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BrandCategory,
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

export class CampaignResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty({ example: 'لانچ محصول تابستانی' })
  title!: string;

  @ApiProperty()
  brief!: string;

  @ApiProperty({ enum: BrandCategory })
  category!: BrandCategory;

  @ApiProperty({ example: 'تهران' })
  city!: string;

  @ApiProperty({ enum: DeliverableType })
  deliverable!: DeliverableType;

  @ApiPropertyOptional({ nullable: true, example: 5_000_000 })
  budgetMin!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 15_000_000 })
  budgetMax!: number | null;

  @ApiProperty({ enum: CampaignStatus })
  status!: CampaignStatus;

  @ApiProperty({ type: CampaignImageResponse, isArray: true })
  images!: CampaignImageResponse[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
