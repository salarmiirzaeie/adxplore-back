import { Injectable } from '@nestjs/common';
import {
  DealStatus,
  NotificationType,
  PaymentStatus,
} from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsService,
  ) {}

  async overview() {
    const [
      users,
      campaigns,
      dealsActive,
      dealsPendingPayment,
      paymentsHeld,
      withdrawPending,
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
    ]);

    return {
      users,
      campaigns,
      dealsActive,
      dealsPendingPayment,
      paymentsHeld,
      withdrawPending: withdrawPending.length,
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
}
