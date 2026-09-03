import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BrandCategory } from '../../generated/prisma/client';

export class BrowseCampaignsQueryDto {
  @ApiPropertyOptional({ enum: BrandCategory })
  @IsOptional()
  @IsEnum(BrandCategory)
  category?: BrandCategory;

  @ApiPropertyOptional({
    example: 'کرج',
    description:
      'Exact city match; also includes nationwide (کل ایران) campaigns',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({
    example: 'البرز',
    description: 'Exact province match; also includes nationwide campaigns',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @ApiPropertyOptional({
    description: 'Search in title and brief',
    example: 'ریلز',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({
    description: 'Match my categories and/or city when set',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  forMe?: boolean;

  @ApiPropertyOptional({
    description: 'Only campaigns I was invited to',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  invited?: boolean;
}
