import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { DealStatus } from '../../generated/prisma/client';

const DEAL_STATUS_UPDATES = [
  DealStatus.COMPLETED,
  DealStatus.REVISION_REQUESTED,
  DealStatus.CANCELLED,
] as const;

export class UpdateDealStatusDto {
  @ApiProperty({
    enum: DEAL_STATUS_UPDATES,
    example: DealStatus.COMPLETED,
  })
  @IsIn(DEAL_STATUS_UPDATES)
  status!: (typeof DEAL_STATUS_UPDATES)[number];

  @ApiPropertyOptional({
    description: 'Required when requesting revision',
    example: 'لطفاً لوگو را واضح‌تر نشان دهید',
  })
  @ValidateIf(
    (o: UpdateDealStatusDto) => o.status === DealStatus.REVISION_REQUESTED,
  )
  @IsString({ message: 'بازخورد برند الزامی است' })
  @MinLength(1)
  @MaxLength(2000)
  brandFeedback?: string;
}
