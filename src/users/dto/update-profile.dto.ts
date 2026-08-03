import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  BrandCategory,
  BrandGoal,
  BusinessSize,
  FollowerRange,
} from '../../generated/prisma/client';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'برند نوآ', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: BrandCategory, example: BrandCategory.BEAUTY })
  @IsOptional()
  @IsEnum(BrandCategory)
  category?: BrandCategory;

  @ApiPropertyOptional({ example: 'تهران', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({
    example: 'https://instagram.com/brand',
    maxLength: 200,
    nullable: true,
    description: 'Instagram handle or website URL. Pass null to clear.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  website?: string | null;

  @ApiPropertyOptional({
    enum: BrandGoal,
    example: BrandGoal.AWARENESS,
    nullable: true,
    description: 'Pass null to clear.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(BrandGoal)
  goal?: BrandGoal | null;

  @ApiPropertyOptional({
    enum: BusinessSize,
    example: BusinessSize.SME,
    nullable: true,
    description: 'Pass null to clear.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(BusinessSize)
  businessSize?: BusinessSize | null;

  @ApiPropertyOptional({
    enum: FollowerRange,
    example: FollowerRange.FROM_10K_50K,
    nullable: true,
    description: 'Influencer follower range. Pass null to clear.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(FollowerRange)
  followerRange?: FollowerRange | null;
}
