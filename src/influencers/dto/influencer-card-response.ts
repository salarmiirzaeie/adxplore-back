import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BrandCategory, FollowerRange } from '../../generated/prisma/client';

export class InfluencerCardResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'سارا محمدی' })
  name!: string;

  @ApiProperty({ example: '@sara' })
  website!: string;

  @ApiPropertyOptional({ nullable: true })
  photoUrl!: string | null;

  @ApiProperty({ enum: BrandCategory })
  category!: BrandCategory;

  @ApiProperty({ example: 'کرج' })
  city!: string;

  @ApiPropertyOptional({ example: 'البرز', nullable: true })
  province!: string | null;

  @ApiProperty({ enum: FollowerRange })
  followerRange!: FollowerRange;
}
