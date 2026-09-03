import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DealStatus,
  InfluencerApprovalStatus,
  NotificationType,
  PaymentStatus,
  UserRole,
  type Prisma,
} from '../generated/prisma/client';
import {
  buildDmMessage,
  DEFAULT_INSTAGRAM_PAGE_USERNAME,
  parseInstagramHandle,
} from '../common/instagram';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { ListInfluencerApprovalsQueryDto } from './dto/influencer-approval.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsService,
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
    ]);

    return {
      users,
      campaigns,
      dealsActive,
      dealsPendingPayment,
      paymentsHeld,
      withdrawPending: withdrawPending.length,
      pendingInfluencers,
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
}
