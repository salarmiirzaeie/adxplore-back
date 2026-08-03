import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  BrandCategory,
  FollowerRange,
} from '../../generated/prisma/client';

export class ListInfluencersQueryDto {
  @ApiPropertyOptional({ enum: BrandCategory })
  @IsOptional()
  @IsEnum(BrandCategory)
  category?: BrandCategory;

  @ApiPropertyOptional({ example: 'تهران' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ enum: FollowerRange })
  @IsOptional()
  @IsEnum(FollowerRange)
  followerRange?: FollowerRange;
}
