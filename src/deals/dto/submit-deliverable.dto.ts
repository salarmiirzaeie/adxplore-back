import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DealContentKind } from '../../generated/prisma/client';

export class SubmitDeliverableDto {
  @ApiPropertyOptional({
    enum: DealContentKind,
    default: DealContentKind.LINK,
    description: 'LINK uses contentUrl; IMAGE/VIDEO require an uploaded file',
  })
  @IsOptional()
  @IsIn(Object.values(DealContentKind))
  kind?: DealContentKind;

  @ApiPropertyOptional({
    example: 'https://www.instagram.com/p/ABC123/',
    description: 'Required when kind is LINK',
  })
  @ValidateIf(
    (o: SubmitDeliverableDto, v: unknown) =>
      (o.kind ?? DealContentKind.LINK) === DealContentKind.LINK ||
      (typeof v === 'string' && v.length > 0),
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @IsUrl({ require_protocol: true }, { message: 'آدرس محتوا معتبر نیست' })
  contentUrl?: string;

  @ApiPropertyOptional({ example: 'ریلز طبق بریف آماده شد' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
