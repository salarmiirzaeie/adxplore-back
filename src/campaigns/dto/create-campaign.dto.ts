import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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

  @ApiProperty({
    enum: BrandCategory,
    isArray: true,
    example: [BrandCategory.BEAUTY, BrandCategory.FASHION],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(BrandCategory, { each: true })
  categories!: BrandCategory[];

  /** @deprecated Prefer categories */
  @ApiPropertyOptional({ enum: BrandCategory, example: BrandCategory.BEAUTY })
  @IsOptional()
  @IsEnum(BrandCategory)
  category?: BrandCategory;

  @ApiProperty({
    example: 'کرج',
    maxLength: 80,
    description: 'City name, or کل ایران for nationwide',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @ApiPropertyOptional({
    example: 'البرز',
    maxLength: 80,
    nullable: true,
    description: 'Required unless city is کل ایران',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(80)
  province?: string | null;

  @ApiProperty({
    enum: DeliverableType,
    isArray: true,
    example: [DeliverableType.REEL, DeliverableType.STORY],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(DeliverableType, { each: true })
  deliverables?: DeliverableType[];

  /** @deprecated Prefer deliverables */
  @ApiPropertyOptional({ enum: DeliverableType, example: DeliverableType.REEL })
  @IsOptional()
  @IsEnum(DeliverableType)
  deliverable?: DeliverableType;

  @ApiPropertyOptional({
    example: 5_000_000,
    description: 'Budget min in toman',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ obj, key }) => {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) return undefined;
    const value = obj[key];
    if (value === null || value === '') return null;
    return value;
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  @Max(10_000_000_000)
  budgetMin?: number | null;

  @ApiPropertyOptional({
    example: 15_000_000,
    description: 'Budget max in toman',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ obj, key }) => {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) return undefined;
    const value = obj[key];
    if (value === null || value === '') return null;
    return value;
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  @Max(10_000_000_000)
  budgetMax?: number | null;

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
