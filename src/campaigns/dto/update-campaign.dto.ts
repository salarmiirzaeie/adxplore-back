import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CampaignStatus } from '../../generated/prisma/client';
import { CreateCampaignDto } from './create-campaign.dto';

export class UpdateCampaignDto extends PartialType(
  OmitType(CreateCampaignDto, ['status'] as const),
) {
  @ApiPropertyOptional({ enum: CampaignStatus, example: CampaignStatus.OPEN })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}
