import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageKind, OfferStatus } from '../../generated/prisma/client';

export class ConversationOfferResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 8_000_000 })
  fee!: number;

  @ApiPropertyOptional({ nullable: true })
  message!: string | null;

  @ApiPropertyOptional({ nullable: true })
  deadline!: Date | null;

  @ApiProperty({ enum: OfferStatus })
  status!: OfferStatus;

  @ApiProperty({
    description:
      'True for the influencer while the offer is PENDING. Show the edit button on the chat offer card.',
  })
  canEdit!: boolean;

  @ApiProperty()
  updatedAt!: Date;
}

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
  peerId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  peerName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  peerPhotoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  peerBio!: string | null;

  @ApiProperty({ type: ConversationOfferResponse })
  offer!: ConversationOfferResponse;

  @ApiPropertyOptional({ type: ChatMessageResponse, nullable: true })
  lastMessage!: ChatMessageResponse | null;

  @ApiProperty()
  unreadCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
