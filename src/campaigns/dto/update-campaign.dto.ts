import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CampaignStatus } from '../../generated/prisma/client';
import { CreateCampaignDto } from './create-campaign.dto';

export class UpdateCampaignDto extends PartialType(
  OmitType(CreateCampaignDto, ['status'] as const),
) {
  @ApiPropertyOptional({
    enum: CampaignStatus,
    example: CampaignStatus.PENDING_REVIEW,
    description:
      'OPEN is remapped to PENDING_REVIEW unless the campaign is already live. Only admin can approve into Explore.',
  })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}
