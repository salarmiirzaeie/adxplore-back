import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length, Matches } from 'class-validator';
import { UserRole } from '../../generated/prisma/client';

export class VerifyOtpDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @Matches(/^(\+98|0|98)?9\d{9}$/, {
    message: 'phone must be a valid Iranian mobile number',
  })
  phone!: string;

  @ApiProperty({ example: '12345', description: 'OTP code from SMS' })
  @IsString()
  @Length(4, 8)
  @Matches(/^\d+$/, { message: 'code must be numeric' })
  code!: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.INFLUENCER,
    description:
      'Login role: INFLUENCER | BRAND | ADMIN (admin cannot self-register)',
  })
  @IsEnum(UserRole)
  role!: UserRole;
}
