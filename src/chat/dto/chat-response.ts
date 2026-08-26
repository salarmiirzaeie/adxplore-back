import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageKind } from '../../generated/prisma/client';

export class ChatMessageResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty({ enum: MessageKind })
  kind!: MessageKind;

  @ApiProperty()
  body!: string;

  @ApiPropertyOptional({ nullable: true, type: Object })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  readAt!: Date | null;
}

export class ConversationResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  offerId!: string;

  @ApiProperty()
  campaignId!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  influencerId!: string;

  @ApiPropertyOptional({ nullable: true })
  campaignTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  peerName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  peerPhotoUrl!: string | null;

  @ApiPropertyOptional({ type: ChatMessageResponse, nullable: true })
  lastMessage!: ChatMessageResponse | null;

  @ApiProperty()
  unreadCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
