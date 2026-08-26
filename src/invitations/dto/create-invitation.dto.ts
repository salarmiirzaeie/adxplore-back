import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  campaignId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  influencerId!: string;

  @ApiPropertyOptional({
    example: 'دوست داریم با شما روی این کمپین کار کنیم',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
