import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SubmitDeliverableDto {
  @ApiProperty({
    example: 'https://www.instagram.com/p/ABC123/',
    description: 'Instagram post / reel / story URL',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @IsUrl({ require_protocol: true }, { message: 'آدرس محتوا معتبر نیست' })
  contentUrl!: string;

  @ApiPropertyOptional({ example: 'ریلز طبق بریف آماده شد' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
