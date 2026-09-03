import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DealStatus,
  MessageKind,
  NotificationType,
  UserRole,
  type User,
} from '../generated/prisma/client';
import {
  mapCampaignCategories,
  mapPartyCategories,
} from '../common/categories';
import { dealCampaignSelect, partySelect } from '../common/party-select';
import { ChatGateway } from '../chat/chat.gateway';
import { ChatService } from '../chat/chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { SubmitDeliverableDto } from './dto/submit-deliverable.dto';
import { UpdateDealStatusDto } from './dto/update-deal-status.dto';
import { assertInfluencerApproved } from '../common/influencer-approval';

const dealInclude = {
  campaign: { select: dealCampaignSelect },
  brand: { select: partySelect },
  influencer: { select: partySelect },
} as const;

type DealWithRelations = {
  id: string;
  offerId: string;
  campaignId: string;
  brandId: string;
  influencerId: string;
  fee: number;
  status: DealStatus;
  contentUrl: string | null;
  note: string | null;
  proofUrl: string | null;
  brandFeedback: string | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  campaign: {
    id: string;
    title: string;
    deliverable: string;
    deliverables?: unknown;
    category?: import('../generated/prisma/client').BrandCategory | null;
    categories: unknown;
    city: string;
    province: string | null;
    status: string;
    brief: string;
    budgetMin: number | null;
    budgetMax: number | null;
  };
  brand: {
    id: string;
    name: string | null;
    photoUrl: string | null;
    website: string | null;
    category?: import('../generated/prisma/client').BrandCategory | null;
    categories: unknown;
    city: string | null;
    province: string | null;
    followerRange: string | null;
  };
  influencer: {
    id: string;
    name: string | null;
    photoUrl: string | null;
    website: string | null;
    category?: import('../generated/prisma/client').BrandCategory | null;
    categories: unknown;
    city: string | null;
    province: string | null;
    followerRange: string | null;
  };
};

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly uploads: UploadsService,
    private readonly chat: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly payments: PaymentsService,
  ) {}

  private async emitChatEvent(
    offerId: string,
    senderId: string,
    kind: MessageKind,
    body: string,
    metadata?: Record<string, unknown>,
  ) {
    const result = await this.chat.postEventMessage({
      offerId,
      senderId,
      kind,
      body,
      metadata,
    });
    if (result) {
      this.chatGateway.emitNewMessage(result.conversationId, result.message);
    }
  }

  toPublic(deal: DealWithRelations) {
    return {
      id: deal.id,
      offerId: deal.offerId,
      campaignId: deal.campaignId,
      brandId: deal.brandId,
      influencerId: deal.influencerId,
      fee: deal.fee,
      status: deal.status,
      contentUrl: deal.contentUrl,
      note: deal.note,
      proofUrl: deal.proofUrl,
      brandFeedback: deal.brandFeedback,
      submittedAt: deal.submittedAt,
      completedAt: deal.completedAt,
      campaign: mapCampaignCategories(deal.campaign),
      brand: mapPartyCategories(deal.brand),
      influencer: mapPartyCategories(deal.influencer),
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
    };
  }

  /** Idempotent: creates a deal from an accepted offer, or returns existing. */
  async createFromOffer(
    offer: {
      id: string;
      campaignId: string;
      brandId: string;
      influencerId: string;
      fee: number;
    },
    campaignTitle: string,
  ) {
    const existing = await this.prisma.deal.findUnique({
      where: { offerId: offer.id },
      include: dealInclude,
    });
    if (existing) {
      return this.toPublic(existing);
    }

    const deal = await this.prisma.deal.create({
      data: {
        offerId: offer.id,
        campaignId: offer.campaignId,
        brandId: offer.brandId,
        influencerId: offer.influencerId,
        fee: offer.fee,
        status: DealStatus.PENDING_PAYMENT,
      },
      include: dealInclude,
    });

    await this.payments.createPendingForDeal(
      {
        id: deal.id,
        offerId: offer.id,
        brandId: offer.brandId,
        influencerId: offer.influencerId,
        fee: offer.fee,
      },
      campaignTitle,
    );

    return this.toPublic(deal);
  }

  async listMine(user: User, campaignId?: string) {
    const where =
      user.role === UserRole.BRAND
        ? {
            brandId: user.id,
            ...(campaignId ? { campaignId } : {}),
          }
        : user.role === UserRole.INFLUENCER
          ? {
              influencerId: user.id,
              ...(campaignId ? { campaignId } : {}),
            }
          : null;

    if (!where) {
      throw new ForbiddenException('نقش نامعتبر است');
    }

    const deals = await this.prisma.deal.findMany({
      where,
      include: dealInclude,
      orderBy: { createdAt: 'desc' },
    });

    return deals.map((d) => this.toPublic(d));
  }

  async getOne(user: User, id: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: dealInclude,
    });
    if (!deal) {
      throw new NotFoundException('همکاری پیدا نشد');
    }
    if (deal.brandId !== user.id && deal.influencerId !== user.id) {
      throw new ForbiddenException('دسترسی به این همکاری ندارید');
    }
    return this.toPublic(deal);
  }

  async submitDeliverable(
    user: User,
    id: string,
    dto: SubmitDeliverableDto,
    proof?: Express.Multer.File,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: { campaign: { select: { title: true } } },
    });
    if (!deal) {
      throw new NotFoundException('همکاری پیدا نشد');
    }
    if (user.id !== deal.influencerId) {
      throw new ForbiddenException('فقط اینفلوئنسر می‌تواند تحویل را ثبت کند');
    }
    assertInfluencerApproved(user);
    if (
      deal.status !== DealStatus.IN_PROGRESS &&
      deal.status !== DealStatus.REVISION_REQUESTED
    ) {
      throw new BadRequestException(
        'فقط در وضعیت در حال انجام یا درخواست اصلاح می‌توان تحویل داد',
      );
    }

    const contentUrl = dto.contentUrl.trim();
    if (!contentUrl) {
      throw new BadRequestException('آدرس محتوا الزامی است');
    }

    let proofUrl: string | null = deal.proofUrl;
    if (proof) {
      this.uploads.assertImageFile(proof);
      if (deal.proofUrl) {
        this.uploads.deleteByPublicUrl(deal.proofUrl);
      }
      const relative = this.uploads.saveImage('deals', proof);
      proofUrl = this.uploads.toPublicUrl(relative);
    }

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        contentUrl,
        note: dto.note?.trim() || null,
        proofUrl,
        brandFeedback: null,
        status: DealStatus.DELIVERED,
        submittedAt: new Date(),
      },
      include: dealInclude,
    });

    await this.notifications.create(
      deal.brandId,
      NotificationType.DELIVERABLE_SUBMITTED,
      'تحویل محتوا',
      `اینفلوئنسر برای کمپین «${deal.campaign.title}» محتوا تحویل داد`,
      `/app/messages/${deal.offerId}`,
      deal.id,
    );

    await this.emitChatEvent(
      deal.offerId,
      deal.influencerId,
      MessageKind.DELIVERABLE,
      'محتوا تحویل داده شد',
      {
        event: 'DELIVERABLE_SUBMITTED',
        dealId: deal.id,
        contentUrl,
        note: dto.note?.trim() || null,
        proofUrl,
      },
    );

    return this.toPublic(updated);
  }

  async updateStatus(user: User, id: string, dto: UpdateDealStatusDto) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: { campaign: { select: { title: true } } },
    });
    if (!deal) {
      throw new NotFoundException('همکاری پیدا نشد');
    }
    if (deal.brandId !== user.id && deal.influencerId !== user.id) {
      throw new ForbiddenException('دسترسی به این همکاری ندارید');
    }

    const next = dto.status;
    const campaignTitle = deal.campaign.title;

    if (next === DealStatus.COMPLETED) {
      if (user.id !== deal.brandId) {
        throw new ForbiddenException('فقط برند می‌تواند تحویل را تأیید کند');
      }
      if (deal.status !== DealStatus.DELIVERED) {
        throw new BadRequestException(
          'فقط پس از تحویل محتوا می‌توان تأیید کرد',
        );
      }

      const updated = await this.prisma.deal.update({
        where: { id },
        data: {
          status: DealStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: dealInclude,
      });

      await this.notifications.create(
        deal.influencerId,
        NotificationType.DEAL_COMPLETED,
        'همکاری تکمیل شد',
        `برند تحویل کمپین «${campaignTitle}» را تأیید کرد`,
        `/app/messages/${deal.offerId}`,
        deal.id,
      );

      await this.emitChatEvent(
        deal.offerId,
        deal.brandId,
        MessageKind.SYSTEM,
        'تحویل تأیید شد · همکاری تکمیل شد',
        { event: 'DEAL_COMPLETED', dealId: deal.id },
      );

      await this.payments.markReleased(deal.id);

      return this.toPublic(updated);
    }

    if (next === DealStatus.REVISION_REQUESTED) {
      if (user.id !== deal.brandId) {
        throw new ForbiddenException('فقط برند می‌تواند اصلاح درخواست کند');
      }
      if (deal.status !== DealStatus.DELIVERED) {
        throw new BadRequestException(
          'فقط پس از تحویل محتوا می‌توان اصلاح درخواست کرد',
        );
      }
      const feedback = dto.brandFeedback?.trim();
      if (!feedback) {
        throw new BadRequestException(
          'بازخورد برند برای درخواست اصلاح الزامی است',
        );
      }

      const updated = await this.prisma.deal.update({
        where: { id },
        data: {
          status: DealStatus.REVISION_REQUESTED,
          brandFeedback: feedback,
        },
        include: dealInclude,
      });

      await this.notifications.create(
        deal.influencerId,
        NotificationType.REVISION_REQUESTED,
        'درخواست اصلاح',
        `برند برای کمپین «${campaignTitle}» اصلاح محتوا درخواست کرد`,
        `/app/messages/${deal.offerId}`,
        deal.id,
      );

      await this.emitChatEvent(
        deal.offerId,
        deal.brandId,
        MessageKind.SYSTEM,
        'درخواست اصلاح محتوا',
        {
          event: 'REVISION_REQUESTED',
          dealId: deal.id,
          brandFeedback: feedback,
        },
      );

      return this.toPublic(updated);
    }

    if (next === DealStatus.CANCELLED) {
      if (
        deal.status !== DealStatus.PENDING_PAYMENT &&
        deal.status !== DealStatus.IN_PROGRESS &&
        deal.status !== DealStatus.REVISION_REQUESTED
      ) {
        throw new BadRequestException(
          'فقط همکاری در انتظار پرداخت، در حال انجام یا در حال اصلاح قابل لغو است',
        );
      }

      const updated = await this.prisma.deal.update({
        where: { id },
        data: { status: DealStatus.CANCELLED },
        include: dealInclude,
      });

      await this.payments.markRefunded(deal.id);

      const otherPartyId =
        user.id === deal.brandId ? deal.influencerId : deal.brandId;

      await this.notifications.create(
        otherPartyId,
        NotificationType.DEAL_CANCELLED,
        'همکاری لغو شد',
        `همکاری کمپین «${campaignTitle}» لغو شد`,
        `/app/messages/${deal.offerId}`,
        deal.id,
      );

      await this.emitChatEvent(
        deal.offerId,
        user.id,
        MessageKind.SYSTEM,
        'همکاری لغو شد',
        { event: 'DEAL_CANCELLED', dealId: deal.id },
      );

      return this.toPublic(updated);
    }

    throw new BadRequestException('وضعیت نامعتبر است');
  }
}
