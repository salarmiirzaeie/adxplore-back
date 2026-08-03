import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  BrandCategory,
  CampaignStatus,
  DeliverableType,
} from '../../generated/prisma/client';

export class CreateCampaignDto {
  @ApiProperty({ example: 'لانچ محصول تابستانی', maxLength: 120 })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    example: 'نیاز به ریویو محصول در استوری و ریلز برای مخاطب زیبایی',
    maxLength: 2000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  brief!: string;

  @ApiProperty({ enum: BrandCategory, example: BrandCategory.BEAUTY })
  @IsEnum(BrandCategory)
  category!: BrandCategory;

  @ApiProperty({ example: 'تهران', maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @ApiProperty({ enum: DeliverableType, example: DeliverableType.REEL })
  @IsEnum(DeliverableType)
  deliverable!: DeliverableType;

  @ApiPropertyOptional({ example: 5_000_000, description: 'Budget min in toman' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000_000)
  budgetMin?: number;

  @ApiPropertyOptional({ example: 15_000_000, description: 'Budget max in toman' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000_000)
  budgetMax?: number;

  @ApiPropertyOptional({
    enum: CampaignStatus,
    example: CampaignStatus.DRAFT,
    description: 'DRAFT or OPEN on create',
  })
  @IsOptional()
  @IsEnum(CampaignStatus)
  @ValidateIf((_, v) => v !== undefined)
  status?: CampaignStatus;
}
