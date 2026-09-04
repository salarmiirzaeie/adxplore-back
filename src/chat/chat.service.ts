import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MessageKind,
  NotificationType,
  OfferStatus,
  Prisma,
  type User,
} from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../media/uploads.service';

export type ChatEventMetadata = Record<string, unknown>;

const conversationOfferSelect = {
  id: true,
  fee: true,
  message: true,
  deadline: true,
  status: true,
  updatedAt: true,
  campaign: { select: { title: true } },
  brand: {
    select: { id: true, name: true, photoUrl: true, bio: true },
  },
  influencer: {
    select: { id: true, name: true, photoUrl: true, bio: true },
  },
} as const;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly uploads: UploadsService,
  ) {}

  toMessage(message: {
    id: string;
    conversationId: string;
    senderId: string;
    kind: MessageKind;
    body: string;
    metadata: unknown;
    createdAt: Date;
    readAt: Date | null;
  }) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      kind: message.kind,
      body: message.body,
      metadata: (message.metadata as ChatEventMetadata | null) ?? null,
      createdAt: message.createdAt,
      readAt: message.readAt,
    };
  }

  /** Create conversation when an offer is sent (idempotent). */
  async createForOffer(offer: {
    id: string;
    campaignId: string;
    brandId: string;
    influencerId: string;
    message?: string | null;
  }) {
    const existing = await this.prisma.conversation.findUnique({
      where: { offerId: offer.id },
    });
    if (existing) return existing;

    const conversation = await this.prisma.conversation.create({
      data: {
        offerId: offer.id,
        campaignId: offer.campaignId,
        brandId: offer.brandId,
        influencerId: offer.influencerId,
      },
    });

    const seed = offer.message?.trim();
    if (seed) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: offer.influencerId,
          kind: MessageKind.TEXT,
          body: seed,
        },
      });
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
    }

    return conversation;
  }

  async assertParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('گفتگو پیدا نشد');
    }
    if (
      conversation.brandId !== userId &&
      conversation.influencerId !== userId
    ) {
      throw new ForbiddenException('به این گفتگو دسترسی ندارید');
    }
    return conversation;
  }

  async getOrCreateByOfferId(user: User, offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { conversation: true },
    });
    if (!offer) {
      throw new NotFoundException('پیشنهاد پیدا نشد');
    }
    if (offer.brandId !== user.id && offer.influencerId !== user.id) {
      throw new ForbiddenException('به این پیشنهاد دسترسی ندارید');
    }

    if (offer.conversation) {
      return this.toConversationPublic(offer.conversation.id, user.id);
    }

    const created = await this.createForOffer(offer);
    return this.toConversationPublic(created.id, user.id);
  }

  async listMine(user: User) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ brandId: user.id }, { influencerId: user.id }],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        offer: {
          select: conversationOfferSelect,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      conversations.map((c) => this.mapConversation(c, user.id)),
    );
  }

  private async mapConversation(
    c: {
      id: string;
      offerId: string;
      campaignId: string;
      brandId: string;
      influencerId: string;
      createdAt: Date;
      updatedAt: Date;
      messages: Array<{
        id: string;
        conversationId: string;
        senderId: string;
        kind: MessageKind;
        body: string;
        metadata: unknown;
        createdAt: Date;
        readAt: Date | null;
      }>;
      offer: {
        id: string;
        fee: number;
        message: string | null;
        deadline: Date | null;
        status: OfferStatus;
        updatedAt: Date;
        campaign: { title: string };
        brand: {
          id: string;
          name: string | null;
          photoUrl: string | null;
          bio: string | null;
        };
        influencer: {
          id: string;
          name: string | null;
          photoUrl: string | null;
          bio: string | null;
        };
      };
    },
    userId: string,
  ) {
    const peer = c.brandId === userId ? c.offer.influencer : c.offer.brand;
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: c.id,
        senderId: { not: userId },
        readAt: null,
      },
    });
    const last = c.messages[0] ?? null;
    return {
      id: c.id,
      offerId: c.offerId,
      campaignId: c.campaignId,
      brandId: c.brandId,
      influencerId: c.influencerId,
      campaignTitle: c.offer.campaign.title,
      peerId: peer.id,
      peerName: peer.name,
      peerPhotoUrl: peer.photoUrl,
      peerBio: peer.bio,
      offer: {
        id: c.offer.id,
        fee: c.offer.fee,
        message: c.offer.message,
        deadline: c.offer.deadline,
        status: c.offer.status,
        canEdit:
          c.offer.status === OfferStatus.PENDING && c.influencerId === userId,
        canUndoReject:
          c.offer.status === OfferStatus.REJECTED && c.brandId === userId,
        updatedAt: c.offer.updatedAt,
      },
      lastMessage: last ? this.toMessage(last) : null,
      unreadCount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  async toConversationPublic(conversationId: string, userId: string) {
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        offer: {
          select: conversationOfferSelect,
        },
      },
    });
    if (!c) {
      throw new NotFoundException('گفتگو پیدا نشد');
    }

    return this.mapConversation(c, userId);
  }

  async getOne(user: User, id: string) {
    await this.assertParticipant(id, user.id);
    return this.toConversationPublic(id, user.id);
  }

  async listMessages(
    user: User,
    conversationId: string,
    opts?: { cursor?: string; take?: number },
  ) {
    await this.assertParticipant(conversationId, user.id);
    const take = Math.min(opts?.take ?? 50, 100);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });

    return messages.reverse().map((m) => this.toMessage(m));
  }

  async sendMessage(
    user: User,
    conversationId: string,
    body?: string,
    file?: Express.Multer.File,
  ) {
    const conversation = await this.assertParticipant(conversationId, user.id);
    const text = body?.trim() ?? '';
    if (!text && !file) {
      throw new BadRequestException('پیام خالی است');
    }

    let kind: MessageKind = MessageKind.TEXT;
    let storedBody = text;
    let metadata: ChatEventMetadata | undefined;

    if (file) {
      const saved = await this.uploads.saveMedia('chat', file);
      kind = saved.kind === 'VIDEO' ? MessageKind.VIDEO : MessageKind.IMAGE;
      if (!storedBody) {
        storedBody = kind === MessageKind.VIDEO ? 'ویدیو' : 'تصویر';
      }
      metadata = {
        mediaUrl: this.uploads.toPublicUrl(saved.relative),
        mimeType: file.mimetype,
      };
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        kind,
        body: storedBody,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const recipientId =
      conversation.brandId === user.id
        ? conversation.influencerId
        : conversation.brandId;

    const preview =
      kind === MessageKind.IMAGE
        ? text
          ? `تصویر · ${text.length > 60 ? `${text.slice(0, 60)}…` : text}`
          : 'تصویر'
        : kind === MessageKind.VIDEO
          ? text
            ? `ویدیو · ${text.length > 60 ? `${text.slice(0, 60)}…` : text}`
            : 'ویدیو'
          : text.length > 80
            ? `${text.slice(0, 80)}…`
            : text;

    await this.notifications.create(
      recipientId,
      NotificationType.CHAT_MESSAGE,
      'پیام جدید',
      preview,
      `/app/messages/${conversation.offerId}`,
      message.id,
    );

    return this.toMessage(message);
  }

  /** System / deliverable timeline entry tied to an offer conversation. */
  async postEventMessage(params: {
    offerId: string;
    senderId: string;
    kind: MessageKind;
    body: string;
    metadata?: ChatEventMetadata;
  }) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { offerId: params.offerId },
    });
    if (!conversation) return null;

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: params.senderId,
        kind: params.kind,
        body: params.body,
        metadata: (params.metadata ?? undefined) as
          Prisma.InputJsonValue | undefined,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return {
      conversationId: conversation.id,
      message: this.toMessage(message),
    };
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
