import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { InfluencerApprovalStatus } from '../../generated/prisma/client';

const STATUS_FILTERS = [
  ...Object.values(InfluencerApprovalStatus),
  'ALL',
] as const;

export class ListInfluencerApprovalsQueryDto {
  @ApiPropertyOptional({
    enum: STATUS_FILTERS,
    default: InfluencerApprovalStatus.PENDING,
  })
  @IsOptional()
  @IsIn([...STATUS_FILTERS])
  status?: InfluencerApprovalStatus | 'ALL';

  @ApiPropertyOptional({
    description: 'Search name, phone, Instagram, or verify code',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class RejectInfluencerDto {
  @ApiPropertyOptional({
    example: 'پیج فالو نشده یا کد در دایرکت پیدا نشد',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
