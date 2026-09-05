import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PushPlatform } from '../../generated/prisma/client';

export class UpsertPushTokenDto {
  @ApiProperty({ example: 'fcm-registration-token' })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token!: string;

  @ApiPropertyOptional({ enum: PushPlatform, default: PushPlatform.WEB })
  @IsOptional()
  @IsEnum(PushPlatform)
  platform?: PushPlatform;
}
