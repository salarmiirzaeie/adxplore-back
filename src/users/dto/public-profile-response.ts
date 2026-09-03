import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BrandCategory,
  BrandGoal,
  BusinessSize,
  FollowerRange,
  UserRole,
} from '../../generated/prisma/client';

/** Marketplace profile (no phone / approval internals). */
export class PublicProfileResponse {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiPropertyOptional({ nullable: true })
  photoUrl!: string | null;

  @ApiPropertyOptional({ enum: BrandCategory, nullable: true })
  category!: BrandCategory | null;

  @ApiProperty({ enum: BrandCategory, isArray: true })
  categories!: BrandCategory[];

  @ApiPropertyOptional({ nullable: true })
  city!: string | null;

  @ApiPropertyOptional({ nullable: true })
  province!: string | null;

  @ApiPropertyOptional({ nullable: true })
  website!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'برند مراقبت از پوست با تمرکز روی محصولات گیاهی.',
  })
  bio!: string | null;

  @ApiPropertyOptional({ enum: BrandGoal, nullable: true })
  goal!: BrandGoal | null;

  @ApiPropertyOptional({ enum: BusinessSize, nullable: true })
  businessSize!: BusinessSize | null;

  @ApiPropertyOptional({ enum: FollowerRange, nullable: true })
  followerRange!: FollowerRange | null;
}
