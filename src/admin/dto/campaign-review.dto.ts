import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CampaignStatus } from '../../generated/prisma/client';

const STATUS_FILTERS = [...Object.values(CampaignStatus), 'ALL'] as const;

export class ListCampaignReviewsQueryDto {
  @ApiPropertyOptional({
    enum: STATUS_FILTERS,
    default: CampaignStatus.PENDING_REVIEW,
  })
  @IsOptional()
  @IsIn([...STATUS_FILTERS])
  status?: CampaignStatus | 'ALL';

  @ApiPropertyOptional({
    description: 'Search title, brief, or brand name/phone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class RejectCampaignDto {
  @ApiPropertyOptional({
    example: 'بریف یا تصاویر کمپین قابل انتشار نیست',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
