import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BrandCategory,
  BrandGoal,
  BusinessSize,
  FollowerRange,
  UserRole,
} from '../generated/prisma/client';

export class RequestOtpResponse {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ example: 'OTP sent' })
  message!: string;

  @ApiProperty({ example: 300, description: 'OTP TTL in seconds' })
  expiresIn!: number;
}

export class AuthUserResponse {
  @ApiProperty({ example: 'clxyz...' })
  id!: string;

  @ApiProperty({ example: '09121234567' })
  phone!: string;

  @ApiPropertyOptional({ example: 'برند نوآ', nullable: true })
  name!: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.INFLUENCER })
  role!: UserRole;

  @ApiPropertyOptional({
    nullable: true,
    example: 'http://localhost:3000/uploads/avatars/abc.jpg',
  })
  photoUrl!: string | null;

  @ApiPropertyOptional({ enum: BrandCategory, nullable: true })
  category!: BrandCategory | null;

  @ApiPropertyOptional({ example: 'تهران', nullable: true })
  city!: string | null;

  @ApiPropertyOptional({ example: 'https://instagram.com/brand', nullable: true })
  website!: string | null;

  @ApiPropertyOptional({ enum: BrandGoal, nullable: true })
  goal!: BrandGoal | null;

  @ApiPropertyOptional({ enum: BusinessSize, nullable: true })
  businessSize!: BusinessSize | null;

  @ApiPropertyOptional({ enum: FollowerRange, nullable: true })
  followerRange!: FollowerRange | null;
}

export class VerifyOtpResponse {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: '7d' })
  expiresIn!: string;

  @ApiProperty({ description: 'True if this phone just created an account' })
  isNewUser!: boolean;

  @ApiProperty({ type: AuthUserResponse })
  user!: AuthUserResponse;
}

export class UserProfileResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: '09121234567' })
  phone!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.INFLUENCER })
  role!: UserRole;

  @ApiPropertyOptional({
    nullable: true,
    example: 'http://localhost:3000/uploads/avatars/abc.jpg',
  })
  photoUrl!: string | null;

  @ApiPropertyOptional({ enum: BrandCategory, nullable: true })
  category!: BrandCategory | null;

  @ApiPropertyOptional({ example: 'تهران', nullable: true })
  city!: string | null;

  @ApiPropertyOptional({ example: 'https://instagram.com/brand', nullable: true })
  website!: string | null;

  @ApiPropertyOptional({ enum: BrandGoal, nullable: true })
  goal!: BrandGoal | null;

  @ApiPropertyOptional({ enum: BusinessSize, nullable: true })
  businessSize!: BusinessSize | null;

  @ApiPropertyOptional({ enum: FollowerRange, nullable: true })
  followerRange!: FollowerRange | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class HealthResponse {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'adxplore-api' })
  service!: string;
}
