import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateOfferTermsDto {
  @ApiPropertyOptional({ example: 8_000_000, description: 'Fee in toman' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000_000)
  fee?: number;

  @ApiPropertyOptional({
    example: 'آماده همکاری هستم؛ تا پایان هفته تحویل می‌دهم',
    maxLength: 1000,
    nullable: true,
    description: 'Pass null or empty to clear.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  message?: string | null;

  @ApiPropertyOptional({
    example: '2026-08-20T00:00:00.000Z',
    nullable: true,
    description: 'Optional deadline ISO date. Pass null to clear.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  deadline?: string | null;
}
