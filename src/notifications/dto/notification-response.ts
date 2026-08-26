import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../generated/prisma/client';

export class NotificationResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiPropertyOptional({ nullable: true })
  linkPath!: string | null;

  @ApiPropertyOptional({ nullable: true })
  entityId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  readAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class UnreadCountResponse {
  @ApiProperty({ example: 3 })
  count!: number;
}
