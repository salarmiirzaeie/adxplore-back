import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateOfferDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  campaignId!: string;

  @ApiProperty({ example: 8_000_000, description: 'Fee in toman' })
  @IsInt()
  @Min(0)
  @Max(10_000_000_000)
  fee!: number;

  @ApiPropertyOptional({
    example: 'آماده همکاری هستم؛ تا پایان هفته تحویل می‌دهم',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({
    example: '2026-08-20T00:00:00.000Z',
    description: 'Optional deadline ISO date',
  })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}
