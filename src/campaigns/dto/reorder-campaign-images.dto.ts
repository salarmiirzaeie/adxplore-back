import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';
import { CAMPAIGN_MAX_IMAGES } from '../../media/uploads.service';

export class ReorderCampaignImagesDto {
  @ApiProperty({
    type: [String],
    example: ['cuid1', 'cuid2'],
    description: 'All campaign image ids in the desired display order',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CAMPAIGN_MAX_IMAGES)
  @IsString({ each: true })
  imageIds!: string[];
}
