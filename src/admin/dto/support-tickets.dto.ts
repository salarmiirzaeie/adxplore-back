import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SupportTicketStatus } from '../../generated/prisma/client';

const STATUS_FILTERS = [...Object.values(SupportTicketStatus), 'ALL'] as const;

export class ListSupportTicketsQueryDto {
  @ApiPropertyOptional({
    enum: STATUS_FILTERS,
    default: SupportTicketStatus.NEW,
  })
  @IsOptional()
  @IsIn([...STATUS_FILTERS])
  status?: SupportTicketStatus | 'ALL';

  @ApiPropertyOptional({
    description: 'Search subject, message, phone, or user name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
