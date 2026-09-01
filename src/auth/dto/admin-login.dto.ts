import { IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({ example: '09035128132' })
  @IsString()
  @Matches(/^(\+98|0|98)?9\d{9}$/, {
    message: 'phone must be a valid Iranian mobile number',
  })
  phone!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
