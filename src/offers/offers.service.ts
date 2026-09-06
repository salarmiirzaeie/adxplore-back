import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  InvitationStatus,
  MessageKind,
  NotificationType,
  OfferStatus,
  UserRole,
  type User,
} from '../generated/prisma/client';
import {
  mapCampaignCategories,
  mapPartyCategories,
} from '../common/categories';
import { offerCampaignSelect, partySelect } from '../common/party-select';
import { ChatGateway } from '../chat/chat.gateway';
import { ChatService } from '../chat/chat.service';
import { DealsService } from '../deals/deals.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import { UpdateOfferTermsDto } from './dto/update-offer-terms.dto';
import { assertInfluencerApproved } from '../common/influencer-approval';

const offerInclude = {
  campaign: { select: offerCampaignSelect },
  brand: { select: partySelect },
  influencer: { select: partySelect },
} as const;

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly deals: DealsService,
    private readonly chat: ChatService,
    private readonly chatGateway: ChatGateway,
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

  toPublic(
    offer: {
      id: string;
      campaignId: string;
      brandId: string;
      influencerId: string;
      fee: number;
      message: string | null;
      deadline: Date | null;
      status: OfferStatus;
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
        bio: string | null;
        category?: import('../generated/prisma/client').BrandCategory | null;
        categories: unknown;
        city: string | null;
        province: string | null;
        followerRange: string | null;
        audienceProofs?: { id: string; url: string; sortOrder: number }[];
      };
      influencer: {
        id: string;
        name: string | null;
        photoUrl: string | null;
        website: string | null;
        bio: string | null;
        category?: import('../generated/prisma/client').BrandCategory | null;
        categories: unknown;
        city: string | null;
        province: string | null;
        followerRange: string | null;
        audienceProofs?: { id: string; url: string; sortOrder: number }[];
      };
    },
    viewerId: string,
  ) {
    return {
      id: offer.id,
      campaignId: offer.campaignId,
      brandId: offer.brandId,
      influencerId: offer.influencerId,
      fee: offer.fee,
      message: offer.message,
      deadline: offer.deadline,
      status: offer.status,
      canEdit:
        offer.status === OfferStatus.PENDING && offer.influencerId === viewerId,
      canUndoReject:
        offer.status === OfferStatus.REJECTED && offer.brandId === viewerId,
      campaign: mapCampaignCategories(offer.campaign),
      brand: mapPartyCategories(offer.brand),
      influencer: mapPartyCategories(offer.influencer),
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }

  async create(user: User, dto: CreateOfferDto) {
    if (user.role !== UserRole.INFLUENCER) {
      throw new ForbiddenException(
        'فقط اینفلوئنسرها می‌توانند پیشنهاد بفرستند',
      );
    }
    assertInfluencerApproved(user);

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: dto.campaignId },
    });
    if (!campaign) {
      throw new NotFoundException('کمپین پیدا نشد');
    }
    if (campaign.status !== CampaignStatus.OPEN) {
      throw new BadRequestException(
        'فقط برای کمپین فعال می‌توان پیشنهاد فرستاد',
      );
    }

    const existingPending = await this.prisma.offer.findFirst({
      where: {
        campaignId: dto.campaignId,
        influencerId: user.id,
        status: OfferStatus.PENDING,
      },
    });
    if (existingPending) {
      throw new BadRequestException('پیشنهاد فعالی برای این کمپین دارید');
    }

    const offer = await this.prisma.offer.create({
      data: {
        campaignId: dto.campaignId,
        brandId: campaign.brandId,
        influencerId: user.id,
        fee: dto.fee,
        message: dto.message?.trim() || null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        status: OfferStatus.PENDING,
      },
      include: offerInclude,
    });

    await this.notifications.create(
      campaign.brandId,
      NotificationType.OFFER_RECEIVED,
      'پیشنهاد جدید',
      `اینفلوئنسر «${user.name?.trim() || 'اینفلوئنسر'}» برای کمپین «${campaign.title}» پیشنهاد فرستاد`,
      `/app/messages/${offer.id}`,
      offer.id,
    );

    await this.chat.createForOffer(offer);

    const invitation = await this.prisma.invitation.findUnique({
      where: {
        campaignId_influencerId: {
          campaignId: dto.campaignId,
          influencerId: user.id,
        },
      },
    });
    if (invitation?.status === InvitationStatus.PENDING) {
      await this.emitChatEvent(
        offer.id,
        user.id,
        MessageKind.SYSTEM,
        'پیشنهاد پس از دعوت برند ارسال شد',
        { event: 'OFFER_AFTER_INVITATION', invitationId: invitation.id },
      );
    }

    return this.toPublic(offer, user.id);
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

    const offers = await this.prisma.offer.findMany({
      where,
      include: offerInclude,
      orderBy: { createdAt: 'desc' },
    });

    return offers.map((o) => this.toPublic(o, user.id));
  }

  async getOne(user: User, id: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: offerInclude,
    });
    if (!offer) {
      throw new NotFoundException('پیشنهاد پیدا نشد');
    }
    if (offer.brandId !== user.id && offer.influencerId !== user.id) {
      throw new ForbiddenException('دسترسی به این پیشنهاد ندارید');
    }
    return this.toPublic(offer, user.id);
  }

  async updateTerms(user: User, id: string, dto: UpdateOfferTermsDto) {
    if (user.role !== UserRole.INFLUENCER) {
      throw new ForbiddenException(
        'فقط اینفلوئنسر می‌تواند پیشنهاد را ویرایش کند',
      );
    }
    if (
      dto.fee === undefined &&
      dto.message === undefined &&
      dto.deadline === undefined
    ) {
      throw new BadRequestException('حداقل یک فیلد برای ویرایش لازم است');
    }

    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: { campaign: { select: { title: true } } },
    });
    if (!offer) {
      throw new NotFoundException('پیشنهاد پیدا نشد');
    }
    if (offer.influencerId !== user.id) {
      throw new ForbiddenException(
        'فقط فرستنده پیشنهاد می‌تواند آن را ویرایش کند',
      );
    }
    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException(
        'فقط تا قبل از پاسخ برند می‌توان پیشنهاد را ویرایش کرد',
      );
    }

    const data: {
      fee?: number;
      message?: string | null;
      deadline?: Date | null;
    } = {};
    if (dto.fee !== undefined) data.fee = dto.fee;
    if (dto.message !== undefined) data.message = dto.message?.trim() || null;
    if (dto.deadline !== undefined) {
      data.deadline = dto.deadline ? new Date(dto.deadline) : null;
    }

    const updated = await this.prisma.offer.update({
      where: { id },
      data,
      include: offerInclude,
    });

    const deadlineChanged =
      (updated.deadline?.getTime() ?? null) !==
      (offer.deadline?.getTime() ?? null);
    const changed =
      updated.fee !== offer.fee ||
      updated.message !== offer.message ||
      deadlineChanged;

    if (changed) {
      await this.notifications.create(
        offer.brandId,
        NotificationType.OFFER_UPDATED,
        'پیشنهاد ویرایش شد',
        `اینفلوئنسر «${user.name?.trim() || 'اینفلوئنسر'}» پیشنهاد کمپین «${offer.campaign.title}» را ویرایش کرد`,
        `/app/messages/${offer.id}`,
        offer.id,
      );
      await this.emitChatEvent(
        offer.id,
        user.id,
        MessageKind.SYSTEM,
        'پیشنهاد ویرایش شد',
        {
          event: 'OFFER_UPDATED',
          fee: updated.fee,
          message: updated.message,
          deadline: updated.deadline,
          previousFee: offer.fee,
          previousMessage: offer.message,
          previousDeadline: offer.deadline,
        },
      );
    }

    return this.toPublic(updated, user.id);
  }

  async updateStatus(user: User, id: string, dto: UpdateOfferStatusDto) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: { campaign: { select: { title: true } } },
    });
    if (!offer) {
      throw new NotFoundException('پیشنهاد پیدا نشد');
    }

    const next = dto.status;
    const campaignTitle = offer.campaign.title;

    if (next === OfferStatus.PENDING) {
      if (user.id !== offer.brandId) {
        throw new ForbiddenException(
          'فقط برند می‌تواند رد پیشنهاد را لغو کند',
        );
      }
      if (offer.status !== OfferStatus.REJECTED) {
        throw new BadRequestException(
          'فقط پیشنهاد ردشده را می‌توان دوباره به حالت در انتظار برگرداند',
        );
      }

      const otherPending = await this.prisma.offer.findFirst({
        where: {
          campaignId: offer.campaignId,
          influencerId: offer.influencerId,
          status: OfferStatus.PENDING,
          id: { not: offer.id },
        },
      });
      if (otherPending) {
        throw new BadRequestException(
          'اینفلوئنسر پیشنهاد فعال دیگری برای این کمپین دارد',
        );
      }

      const updated = await this.prisma.offer.update({
        where: { id },
        data: { status: OfferStatus.PENDING },
        include: offerInclude,
      });

      await this.notifications.create(
        offer.influencerId,
        NotificationType.OFFER_REOPENED,
        'رد پیشنهاد لغو شد',
        `برند رد پیشنهاد کمپین «${campaignTitle}» را لغو کرد`,
        `/app/messages/${offer.id}`,
        offer.id,
      );
      await this.emitChatEvent(
        offer.id,
        user.id,
        MessageKind.SYSTEM,
        'رد پیشنهاد لغو شد',
        { event: 'OFFER_REOPENED' },
      );

      return this.toPublic(updated, user.id);
    }

    if (next === OfferStatus.CANCELLED) {
      if (user.id !== offer.influencerId) {
        throw new ForbiddenException(
          'فقط اینفلوئنسر می‌تواند پیشنهاد را لغو کند',
        );
      }
      if (offer.status !== OfferStatus.PENDING) {
        throw new BadRequestException(
          'فقط پیشنهادهای در انتظار قابل لغو هستند',
        );
      }
    } else if (next === OfferStatus.REJECTED) {
      if (user.id !== offer.brandId) {
        throw new ForbiddenException(
          'فقط برند می‌تواند پیشنهاد را رد کند',
        );
      }
      if (offer.status !== OfferStatus.PENDING) {
        throw new BadRequestException(
          'فقط پیشنهادهای در انتظار قابل رد هستند',
        );
      }
    } else if (next === OfferStatus.ACCEPTED) {
      if (user.id !== offer.brandId) {
        throw new ForbiddenException(
          'فقط برند می‌تواند پیشنهاد را قبول کند',
        );
      }
      if (
        offer.status !== OfferStatus.PENDING &&
        offer.status !== OfferStatus.REJECTED
      ) {
        throw new BadRequestException(
          'فقط پیشنهاد در انتظار یا ردشده قابل قبول است',
        );
      }
    } else {
      throw new BadRequestException('وضعیت نامعتبر است');
    }

    const updated = await this.prisma.offer.update({
      where: { id },
      data: { status: next },
      include: offerInclude,
    });

    if (next === OfferStatus.ACCEPTED) {
      await this.deals.createFromOffer(
        {
          id: offer.id,
          campaignId: offer.campaignId,
          brandId: offer.brandId,
          influencerId: offer.influencerId,
          fee: offer.fee,
        },
        campaignTitle,
      );
    } else if (next === OfferStatus.REJECTED) {
      await this.notifications.create(
        offer.influencerId,
        NotificationType.OFFER_REJECTED,
        'پیشنهاد رد شد',
        `پیشنهاد شما برای کمپین «${campaignTitle}» رد شد`,
        `/app/messages/${offer.id}`,
        offer.id,
      );
      await this.emitChatEvent(
        offer.id,
        user.id,
        MessageKind.SYSTEM,
        'پیشنهاد رد شد',
        { event: 'OFFER_REJECTED' },
      );
    } else if (next === OfferStatus.CANCELLED) {
      await this.notifications.create(
        offer.brandId,
        NotificationType.OFFER_CANCELLED,
        'پیشنهاد لغو شد',
        `پیشنهاد برای کمپین «${campaignTitle}» لغو شد`,
        `/app/messages/${offer.id}`,
        offer.id,
      );
      await this.emitChatEvent(
        offer.id,
        user.id,
        MessageKind.SYSTEM,
        'پیشنهاد لغو شد',
        { event: 'OFFER_CANCELLED' },
      );
    }

    return this.toPublic(updated, user.id);
  }
}
