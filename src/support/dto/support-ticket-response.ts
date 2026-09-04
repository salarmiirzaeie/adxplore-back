import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportTicketStatus, UserRole } from '../../generated/prisma/client';

export class SupportTicketUserResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  phone!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;
}

export class SupportTicketResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ enum: SupportTicketStatus })
  status!: SupportTicketStatus;

  @ApiPropertyOptional({ nullable: true })
  readAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  resolvedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class AdminSupportTicketResponse extends SupportTicketResponse {
  @ApiProperty({ type: SupportTicketUserResponse })
  user!: SupportTicketUserResponse;
}
