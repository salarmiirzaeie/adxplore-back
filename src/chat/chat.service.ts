import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MessageKind,
  NotificationType,
  Prisma,
  type User,
} from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export type ChatEventMetadata = Record<string, unknown>;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
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
          select: {
            campaign: { select: { title: true } },
            brand: { select: { id: true, name: true, photoUrl: true } },
            influencer: { select: { id: true, name: true, photoUrl: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      conversations.map(async (c) => {
        const peer =
          c.brandId === user.id ? c.offer.influencer : c.offer.brand;
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: user.id },
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
          peerName: peer.name,
          peerPhotoUrl: peer.photoUrl,
          lastMessage: last ? this.toMessage(last) : null,
          unreadCount,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      }),
    );
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
          select: {
            campaign: { select: { title: true } },
            brand: { select: { id: true, name: true, photoUrl: true } },
            influencer: { select: { id: true, name: true, photoUrl: true } },
          },
        },
      },
    });
    if (!c) {
      throw new NotFoundException('گفتگو پیدا نشد');
    }

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
      peerName: peer.name,
      peerPhotoUrl: peer.photoUrl,
      lastMessage: last ? this.toMessage(last) : null,
      unreadCount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
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
      ...(opts?.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
    });

    return messages.reverse().map((m) => this.toMessage(m));
  }

  async sendMessage(user: User, conversationId: string, body: string) {
    const conversation = await this.assertParticipant(
      conversationId,
      user.id,
    );
    const text = body.trim();
    if (!text) {
      throw new BadRequestException('پیام خالی است');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        kind: MessageKind.TEXT,
        body: text,
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

    const preview = text.length > 80 ? `${text.slice(0, 80)}…` : text;

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
          | Prisma.InputJsonValue
          | undefined,
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
