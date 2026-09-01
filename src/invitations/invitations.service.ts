import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  InvitationStatus,
  NotificationType,
  UserRole,
  type User,
} from '../generated/prisma/client';
import {
  mapCampaignCategories,
  mapPartyCategories,
  parseCategories,
} from '../common/categories';
import {
  invitationCampaignSelect,
  partySelect,
} from '../common/party-select';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateInvitationStatusDto } from './dto/update-invitation-status.dto';

const invitationInclude = {
  campaign: { select: invitationCampaignSelect },
  brand: { select: partySelect },
  influencer: { select: partySelect },
} as const;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  toPublic(inv: {
    id: string;
    campaignId: string;
    brandId: string;
    influencerId: string;
    message: string | null;
    status: InvitationStatus;
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
  }) {
    return {
      id: inv.id,
      campaignId: inv.campaignId,
      brandId: inv.brandId,
      influencerId: inv.influencerId,
      message: inv.message,
      status: inv.status,
      campaign: mapCampaignCategories(inv.campaign),
      brand: mapPartyCategories(inv.brand),
      influencer: mapPartyCategories(inv.influencer),
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    };
  }

  async create(user: User, dto: CreateInvitationDto) {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException('فقط برندها می‌توانند دعوت بفرستند');
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: dto.campaignId },
    });
    if (!campaign || campaign.brandId !== user.id) {
      throw new NotFoundException('کمپین پیدا نشد');
    }
    if (campaign.status !== CampaignStatus.OPEN) {
      throw new BadRequestException('فقط برای کمپین فعال می‌توان دعوت فرستاد');
    }

    const influencer = await this.prisma.user.findUnique({
      where: { id: dto.influencerId },
    });
    if (
      !influencer ||
      influencer.role !== UserRole.INFLUENCER ||
      !influencer.name?.trim() ||
      !influencer.website?.trim() ||
      !parseCategories(influencer.categories, influencer.category).length ||
      !influencer.city?.trim() ||
      !influencer.province?.trim() ||
      !influencer.followerRange
    ) {
      throw new NotFoundException('اینفلوئنسر پیدا نشد');
    }

    const existing = await this.prisma.invitation.findUnique({
      where: {
        campaignId_influencerId: {
          campaignId: dto.campaignId,
          influencerId: dto.influencerId,
        },
      },
    });

    const message = dto.message?.trim() || null;

    if (existing) {
      if (existing.status === InvitationStatus.PENDING) {
        throw new BadRequestException(
          'دعوت فعالی برای این اینفلوئنسر روی این کمپین وجود دارد',
        );
      }

      const updated = await this.prisma.invitation.update({
        where: { id: existing.id },
        data: {
          status: InvitationStatus.PENDING,
          message,
          brandId: user.id,
        },
        include: invitationInclude,
      });

      await this.notifications.create(
        influencer.id,
        NotificationType.INVITATION_RECEIVED,
        'دعوت جدید',
        `برند «${user.name?.trim() || 'برند'}» شما را به کمپین «${campaign.title}» دعوت کرد`,
        `/app/campaigns/${campaign.id}`,
        updated.id,
      );

      return this.toPublic(updated);
    }

    const invitation = await this.prisma.invitation.create({
      data: {
        campaignId: dto.campaignId,
        brandId: user.id,
        influencerId: dto.influencerId,
        message,
        status: InvitationStatus.PENDING,
      },
      include: invitationInclude,
    });

    await this.notifications.create(
      influencer.id,
      NotificationType.INVITATION_RECEIVED,
      'دعوت جدید',
      `برند «${user.name?.trim() || 'برند'}» شما را به کمپین «${campaign.title}» دعوت کرد`,
      `/app/campaigns/${campaign.id}`,
      invitation.id,
    );

    return this.toPublic(invitation);
  }

  async createBulk(user: User, dto: { campaignId: string; influencerIds: string[]; message?: string }) {
    const uniqueIds = [...new Set(dto.influencerIds.filter(Boolean))];
    const created = [];
    const skipped: string[] = [];

    for (const influencerId of uniqueIds) {
      try {
        const invitation = await this.create(user, {
          campaignId: dto.campaignId,
          influencerId,
          message: dto.message,
        });
        created.push(invitation);
      } catch {
        skipped.push(influencerId);
      }
    }

    return { created, skippedCount: skipped.length };
  }

  async listMine(user: User, campaignId?: string) {
    if (user.role === UserRole.BRAND) {
      const where: {
        brandId: string;
        campaignId?: string;
      } = { brandId: user.id };
      if (campaignId) {
        where.campaignId = campaignId;
      }
      const items = await this.prisma.invitation.findMany({
        where,
        include: invitationInclude,
        orderBy: { createdAt: 'desc' },
      });
      return items.map((i) => this.toPublic(i));
    }

    if (user.role === UserRole.INFLUENCER) {
      if (campaignId) {
        throw new ForbiddenException('فیلتر کمپین فقط برای برند مجاز است');
      }
      const items = await this.prisma.invitation.findMany({
        where: { influencerId: user.id },
        include: invitationInclude,
        orderBy: { createdAt: 'desc' },
      });
      return items.map((i) => this.toPublic(i));
    }

    throw new ForbiddenException('نقش نامعتبر است');
  }

  async getOne(user: User, id: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
      include: invitationInclude,
    });
    if (!invitation) {
      throw new NotFoundException('دعوت پیدا نشد');
    }
    if (
      invitation.brandId !== user.id &&
      invitation.influencerId !== user.id
    ) {
      throw new ForbiddenException('دسترسی به این دعوت ندارید');
    }
    return this.toPublic(invitation);
  }

  async updateStatus(user: User, id: string, dto: UpdateInvitationStatusDto) {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException('فقط برند می‌تواند دعوت را لغو کند');
    }

    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });
    if (!invitation) {
      throw new NotFoundException('دعوت پیدا نشد');
    }
    if (invitation.brandId !== user.id) {
      throw new ForbiddenException('دسترسی به این دعوت ندارید');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('فقط دعوت‌های در انتظار قابل لغو هستند');
    }
    if (dto.status !== InvitationStatus.CANCELLED) {
      throw new BadRequestException('وضعیت نامعتبر است');
    }

    const updated = await this.prisma.invitation.update({
      where: { id },
      data: { status: InvitationStatus.CANCELLED },
      include: invitationInclude,
    });

    return this.toPublic(updated);
  }
}
