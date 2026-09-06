import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CampaignStatus,
  DealStatus,
  InfluencerApprovalStatus,
  SupportTicketStatus,
  InvitationStatus,
  NotificationType,
  PaymentStatus,
  UserRole,
  type BrandCategory,
  type DeliverableType,
  type Prisma,
} from '../generated/prisma/client';
import { parseCategories } from '../common/categories';
import {
  audienceProofSelect,
  mapAudienceProofs,
} from '../common/audience-proof';
import { parseDeliverables } from '../common/deliverables';
import {
  buildDmMessage,
  DEFAULT_INSTAGRAM_PAGE_USERNAME,
  parseInstagramHandle,
} from '../common/instagram';
import { InvitationsService } from '../invitations/invitations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import {
  ListCampaignReviewsQueryDto,
  RejectCampaignDto,
} from './dto/campaign-review.dto';
import { ListInfluencerApprovalsQueryDto } from './dto/influencer-approval.dto';
import { ListSupportTicketsQueryDto } from './dto/support-tickets.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsService,
    private readonly invitations: InvitationsService,
    private readonly config: ConfigService,
  ) {}

  async overview() {
    const [
      users,
      campaigns,
      dealsActive,
      dealsPendingPayment,
      paymentsHeld,
      withdrawPending,
      pendingInfluencers,
      pendingCampaigns,
      pendingSupport,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.campaign.count(),
      this.prisma.deal.count({
        where: {
          status: {
            in: [
              DealStatus.IN_PROGRESS,
              DealStatus.DELIVERED,
              DealStatus.REVISION_REQUESTED,
            ],
          },
        },
      }),
      this.prisma.deal.count({
        where: { status: DealStatus.PENDING_PAYMENT },
      }),
      this.prisma.payment.count({
        where: { status: PaymentStatus.HELD },
      }),
      this.wallets.listWithdrawRequests('pending'),
      this.prisma.user.count({
        where: {
          role: UserRole.INFLUENCER,
          approvalStatus: InfluencerApprovalStatus.PENDING,
        },
      }),
      this.prisma.campaign.count({
        where: { status: CampaignStatus.PENDING_REVIEW },
      }),
      this.prisma.supportTicket.count({
        where: { status: SupportTicketStatus.NEW },
      }),
    ]);

    return {
      users,
      campaigns,
      dealsActive,
      dealsPendingPayment,
      paymentsHeld,
      withdrawPending: withdrawPending.length,
      pendingInfluencers,
      pendingCampaigns,
      pendingSupport,
    };
  }

  listWithdrawals(status: 'pending' | 'all' = 'pending') {
    return this.wallets.listWithdrawRequests(status);
  }

  async completeWithdrawal(requestTxId: string) {
    const result = await this.wallets.completeWithdraw(requestTxId);
    const request = await this.prisma.walletTransaction.findUnique({
      where: { id: requestTxId },
      include: { wallet: true },
    });
    if (request) {
      await this.notifications.create(
        request.wallet.userId,
        NotificationType.WALLET_CREDITED,
        'برداشت انجام شد',
        `${request.amountToman.toLocaleString('fa-IR')} تومان به حساب بانکی شما واریز شد.`,
        '/app/wallet',
        request.id,
      );
    }
    return result;
  }

  async rejectWithdrawal(requestTxId: string) {
    const result = await this.wallets.rejectWithdraw(requestTxId);
    const request = await this.prisma.walletTransaction.findUnique({
      where: { id: requestTxId },
      include: { wallet: true },
    });
    if (request) {
      await this.notifications.create(
        request.wallet.userId,
        NotificationType.WALLET_CREDITED,
        'برداشت رد شد',
        `درخواست برداشت ${request.amountToman.toLocaleString('fa-IR')} تومان رد شد و مبلغ به موجودی قابل برداشت برگشت.`,
        '/app/wallet',
        request.id,
      );
    }
    return result;
  }

  async listDeals(take = 50) {
    const items = await this.prisma.deal.findMany({
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
      include: {
        campaign: { select: { id: true, title: true } },
        brand: { select: { id: true, phone: true, name: true } },
        influencer: { select: { id: true, phone: true, name: true } },
        payment: true,
      },
    });
    return items.map((d) => ({
      id: d.id,
      status: d.status,
      fee: d.fee,
      campaign: d.campaign,
      brand: d.brand,
      influencer: d.influencer,
      payment: d.payment
        ? {
            id: d.payment.id,
            status: d.payment.status,
            amountToman: d.payment.amountToman,
            authority: d.payment.authority,
            refId: d.payment.refId,
          }
        : null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  async listPayments(take = 50) {
    const items = await this.prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
      include: {
        deal: {
          select: {
            id: true,
            status: true,
            campaign: { select: { id: true, title: true } },
          },
        },
        brand: { select: { id: true, phone: true, name: true } },
        influencer: { select: { id: true, phone: true, name: true } },
      },
    });
    return items.map((p) => ({
      id: p.id,
      status: p.status,
      amountToman: p.amountToman,
      authority: p.authority,
      refId: p.refId,
      deal: p.deal,
      brand: p.brand,
      influencer: p.influencer,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async listInfluencerApprovals(query: ListInfluencerApprovalsQueryDto) {
    const status =
      query.status === 'ALL'
        ? undefined
        : (query.status ?? InfluencerApprovalStatus.PENDING);
    const q = query.q?.trim();

    const where: Prisma.UserWhereInput = {
      role: UserRole.INFLUENCER,
      ...(status
        ? { approvalStatus: status }
        : { approvalStatus: { not: null } }),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q } },
              { website: { contains: q } },
              { instagramVerifyCode: { contains: q } },
            ],
          }
        : {}),
    };

    const items = await this.prisma.user.findMany({
      where,
      include: {
        audienceProofs: {
          select: audienceProofSelect,
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ instagramDmMarkedSentAt: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });

    const pageUsername =
      this.config.get<string>('INSTAGRAM_PAGE_USERNAME')?.trim() ||
      DEFAULT_INSTAGRAM_PAGE_USERNAME;

    return items.map((u) => {
      const handle = parseInstagramHandle(u.website);
      return {
        id: u.id,
        phone: u.phone,
        name: u.name,
        website: u.website,
        instagramHandle: handle,
        photoUrl: u.photoUrl,
        bio: u.bio,
        audienceProofs: mapAudienceProofs(u.audienceProofs),
        city: u.city,
        province: u.province,
        followerRange: u.followerRange,
        approvalStatus: u.approvalStatus,
        verifyCode: u.instagramVerifyCode,
        dmMessage: u.instagramVerifyCode
          ? buildDmMessage({
              verifyCode: u.instagramVerifyCode,
              influencerHandle: handle,
              influencerName: u.name,
            })
          : null,
        markedSentAt: u.instagramDmMarkedSentAt,
        approvedAt: u.approvedAt,
        rejectedAt: u.rejectedAt,
        rejectionReason: u.rejectionReason,
        instagramPage: pageUsername,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    });
  }

  async approveInfluencer(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== UserRole.INFLUENCER) {
      throw new NotFoundException('اینفلوئنسر پیدا نشد');
    }
    if (user.approvalStatus === InfluencerApprovalStatus.APPROVED) {
      throw new BadRequestException('این حساب قبلاً تأیید شده است');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        approvalStatus: InfluencerApprovalStatus.APPROVED,
        approvedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
      },
    });

    await this.notifications.create(
      user.id,
      NotificationType.INFLUENCER_APPROVED,
      'حساب شما تأیید شد',
      'فالو و دایرکت بررسی شد. حالا می‌توانید در پنل ادکسپلور کار کنید.',
      '/app',
      user.id,
    );

    return {
      id: updated.id,
      approvalStatus: updated.approvalStatus,
      approvedAt: updated.approvedAt,
    };
  }

  async rejectInfluencer(id: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== UserRole.INFLUENCER) {
      throw new NotFoundException('اینفلوئنسر پیدا نشد');
    }
    if (user.approvalStatus === InfluencerApprovalStatus.APPROVED) {
      throw new BadRequestException('حساب تأییدشده را نمی‌توان رد کرد');
    }

    const rejectionReason =
      reason?.trim() ||
      'پیج فالو نشده یا کد تأیید در دایرکت پیدا نشد. دوباره فالو کنید و همان کد را دایرکت بفرستید.';

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        approvalStatus: InfluencerApprovalStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason,
        instagramDmMarkedSentAt: null,
      },
    });

    await this.notifications.create(
      user.id,
      NotificationType.INFLUENCER_REJECTED,
      'درخواست عضویت رد شد',
      rejectionReason,
      '/app/instagram-approval',
      user.id,
    );

    return {
      id: updated.id,
      approvalStatus: updated.approvalStatus,
      rejectionReason: updated.rejectionReason,
      rejectedAt: updated.rejectedAt,
    };
  }

  async listCampaignReviews(query: ListCampaignReviewsQueryDto) {
    const status =
      query.status === 'ALL'
        ? undefined
        : (query.status ?? CampaignStatus.PENDING_REVIEW);
    const q = query.q?.trim();

    const where: Prisma.CampaignWhereInput = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { brief: { contains: q } },
              { brand: { name: { contains: q } } },
              { brand: { phone: { contains: q } } },
            ],
          }
        : {}),
    };

    const items = await this.prisma.campaign.findMany({
      where,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        brand: {
          select: {
            id: true,
            name: true,
            phone: true,
            photoUrl: true,
          },
        },
        _count: {
          select: {
            invitations: { where: { status: InvitationStatus.PENDING } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return items.map((c) => this.toAdminCampaign(c));
  }

  async approveCampaign(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('کمپین پیدا نشد');
    }
    if (campaign.status !== CampaignStatus.PENDING_REVIEW) {
      throw new BadRequestException('فقط کمپین در صف بررسی را می‌توان تأیید کرد');
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.OPEN,
        rejectionReason: null,
        rejectedAt: null,
      },
    });

    await this.invitations.deliverQueuedInvites(updated);

    return this.getAdminCampaign(id);
  }

  async rejectCampaign(id: string, dto: RejectCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('کمپین پیدا نشد');
    }
    if (
      campaign.status !== CampaignStatus.PENDING_REVIEW &&
      campaign.status !== CampaignStatus.OPEN
    ) {
      throw new BadRequestException('این کمپین قابل رد نیست');
    }

    const rejectionReason =
      dto.reason?.trim() ||
      'محتوای کمپین تأیید نشد. لطفاً بریف و تصاویر را اصلاح کنید و دوباره ارسال کنید.';

    await this.prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.DRAFT,
        rejectionReason,
        rejectedAt: new Date(),
      },
    });

    await this.notifications.create(
      campaign.brandId,
      NotificationType.CAMPAIGN_REJECTED,
      'کمپین رد شد',
      rejectionReason,
      `/app/campaigns/${campaign.id}`,
      campaign.id,
    );

    return this.getAdminCampaign(id);
  }

  private async getAdminCampaign(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        brand: {
          select: {
            id: true,
            name: true,
            phone: true,
            photoUrl: true,
          },
        },
        _count: {
          select: {
            invitations: { where: { status: InvitationStatus.PENDING } },
          },
        },
      },
    });
    if (!campaign) {
      throw new NotFoundException('کمپین پیدا نشد');
    }
    return this.toAdminCampaign(campaign);
  }

  private toAdminCampaign(campaign: {
    id: string;
    title: string;
    brief: string;
    category: BrandCategory;
    categories: unknown;
    city: string;
    province: string | null;
    deliverable: DeliverableType;
    deliverables: unknown;
    budgetMin: number | null;
    budgetMax: number | null;
    status: CampaignStatus;
    rejectionReason: string | null;
    rejectedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    images: Array<{ id: string; url: string; sortOrder: number }>;
    brand: {
      id: string;
      name: string | null;
      phone: string;
      photoUrl: string | null;
    };
    _count: { invitations: number };
  }) {
    const categories = parseCategories(campaign.categories, campaign.category);
    const deliverables = parseDeliverables(
      campaign.deliverables,
      campaign.deliverable,
    );
    return {
      id: campaign.id,
      title: campaign.title,
      brief: campaign.brief,
      category: campaign.category,
      categories,
      city: campaign.city,
      province: campaign.province,
      deliverable: campaign.deliverable,
      deliverables,
      budgetMin: campaign.budgetMin,
      budgetMax: campaign.budgetMax,
      status: campaign.status,
      rejectionReason: campaign.rejectionReason,
      rejectedAt: campaign.rejectedAt,
      pendingInvites: campaign._count.invitations,
      images: campaign.images.map((img) => ({
        id: img.id,
        url: img.url,
        sortOrder: img.sortOrder,
      })),
      brand: campaign.brand,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  async listSupportTickets(query: ListSupportTicketsQueryDto) {
    const status =
      query.status === 'ALL'
        ? undefined
        : (query.status ?? SupportTicketStatus.NEW);
    const q = query.q?.trim();

    const where: Prisma.SupportTicketWhereInput = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { subject: { contains: q } },
              { message: { contains: q } },
              { phone: { contains: q } },
              { user: { name: { contains: q } } },
              { user: { phone: { contains: q } } },
            ],
          }
        : {}),
    };

    const items = await this.prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: { id: true, phone: true, name: true, role: true },
        },
      },
    });

    return items.map((t) => this.toSupportTicket(t));
  }

  async markSupportTicketRead(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, phone: true, name: true, role: true },
        },
      },
    });
    if (!ticket) {
      throw new NotFoundException('پیام پشتیبانی پیدا نشد');
    }
    if (ticket.status !== SupportTicketStatus.NEW) {
      return this.toSupportTicket(ticket);
    }
    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: SupportTicketStatus.READ,
        readAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, phone: true, name: true, role: true },
        },
      },
    });
    return this.toSupportTicket(updated);
  }

  async resolveSupportTicket(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });
    if (!ticket) {
      throw new NotFoundException('پیام پشتیبانی پیدا نشد');
    }
    const now = new Date();
    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: SupportTicketStatus.RESOLVED,
        readAt: ticket.readAt ?? now,
        resolvedAt: ticket.resolvedAt ?? now,
      },
      include: {
        user: {
          select: { id: true, phone: true, name: true, role: true },
        },
      },
    });
    return this.toSupportTicket(updated);
  }

  private toSupportTicket(t: {
    id: string;
    userId: string;
    phone: string;
    subject: string;
    message: string;
    status: SupportTicketStatus;
    readAt: Date | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      phone: string;
      name: string | null;
      role: UserRole;
    };
  }) {
    return {
      id: t.id,
      userId: t.userId,
      phone: t.phone,
      subject: t.subject,
      message: t.message,
      status: t.status,
      readAt: t.readAt,
      resolvedAt: t.resolvedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      user: t.user,
    };
  }
}
