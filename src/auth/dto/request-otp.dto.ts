import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    example: '09121234567',
    description: 'Iranian mobile number (09…, +989…, or 9…)',
  })
  @IsString()
  @Matches(/^(\+98|0|98)?9\d{9}$/, {
    message: 'phone must be a valid Iranian mobile number',
  })
  phone!: string;
}
