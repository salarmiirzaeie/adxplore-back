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
  PaymentStatus,
  UserRole,
  type Payment,
  type User,
} from '../generated/prisma/client';
import { ChatGateway } from '../chat/chat.gateway';
import { ChatService } from '../chat/chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { ZarinpalService } from './zarinpal.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zarinpal: ZarinpalService,
    private readonly notifications: NotificationsService,
    private readonly chat: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly wallets: WalletsService,
  ) {}

  toPublic(p: Payment) {
    return {
      id: p.id,
      dealId: p.dealId,
      brandId: p.brandId,
      influencerId: p.influencerId,
      amountToman: p.amountToman,
      amountRial: p.amountRial,
      description: p.description,
      authority: p.authority,
      refId: p.refId,
      cardPan: p.cardPan,
      status: p.status,
      errorMessage: p.errorMessage,
      paidAt: p.paidAt,
      releasedAt: p.releasedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

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

  /** Called when a deal is created after offer accept. */
  async createPendingForDeal(
    deal: {
      id: string;
      offerId: string;
      brandId: string;
      influencerId: string;
      fee: number;
    },
    campaignTitle: string,
  ) {
    const amountToman = deal.fee;
    const amountRial = this.zarinpal.tomanToRial(amountToman);
    const description = `پرداخت همکاری کمپین «${campaignTitle}»`;

    const payment = await this.prisma.payment.create({
      data: {
        dealId: deal.id,
        brandId: deal.brandId,
        influencerId: deal.influencerId,
        amountToman,
        amountRial,
        description,
        status: PaymentStatus.PENDING,
      },
    });

    await this.notifications.create(
      deal.brandId,
      NotificationType.PAYMENT_REQUIRED,
      'پرداخت برای شروع همکاری',
      `برای شروع همکاری کمپین «${campaignTitle}» مبلغ ${amountToman.toLocaleString('fa-IR')} تومان را پرداخت کنید`,
      `/app/messages/${deal.offerId}`,
      payment.id,
    );

    await this.emitChatEvent(
      deal.offerId,
      deal.brandId,
      MessageKind.SYSTEM,
      `پرداخت لازم است · ${amountToman.toLocaleString('fa-IR')} تومان`,
      {
        event: 'PAYMENT_REQUIRED',
        dealId: deal.id,
        paymentId: payment.id,
        amountToman,
      },
    );

    return this.toPublic(payment);
  }

  async requestForDeal(user: User, dealId: string) {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException('فقط برند می‌تواند پرداخت کند');
    }

    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        payment: true,
        campaign: { select: { title: true } },
        brand: { select: { phone: true } },
      },
    });
    if (!deal) throw new NotFoundException('همکاری پیدا نشد');
    if (deal.brandId !== user.id) {
      throw new ForbiddenException('دسترسی به این همکاری ندارید');
    }
    if (deal.status !== DealStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        'این همکاری در انتظار پرداخت نیست یا قبلاً پرداخت شده',
      );
    }

    let payment = deal.payment;
    if (!payment) {
      payment = await this.prisma.payment.create({
        data: {
          dealId: deal.id,
          brandId: deal.brandId,
          influencerId: deal.influencerId,
          amountToman: deal.fee,
          amountRial: this.zarinpal.tomanToRial(deal.fee),
          description: `پرداخت همکاری کمپین «${deal.campaign.title}»`,
          status: PaymentStatus.PENDING,
        },
      });
    }

    if (
      payment.status === PaymentStatus.HELD ||
      payment.status === PaymentStatus.RELEASED
    ) {
      throw new BadRequestException('این پرداخت قبلاً انجام شده است');
    }

    // Reuse existing authority so double-clicks don't create multiple charges
    if (
      payment.status === PaymentStatus.PENDING &&
      payment.authority &&
      /^A[0-9A-Za-z]+$/.test(payment.authority)
    ) {
      return {
        success: true,
        paymentId: payment.id,
        authority: payment.authority,
        paymentUrl: this.zarinpal.startPayUrl(payment.authority),
        amountToman: payment.amountToman,
        amountRial: payment.amountRial,
        reused: true,
        sandbox: this.zarinpal.isSandbox(),
        status: payment.status,
      };
    }

    if (payment.amountToman < 1000) {
      throw new BadRequestException('حداقل مبلغ پرداخت ۱٬۰۰۰ تومان است');
    }

    const result = await this.zarinpal.requestPayment({
      amountRial: payment.amountRial,
      description: payment.description || `پرداخت همکاری AdXplore`,
      mobile: deal.brand.phone,
      metadata: {
        deal_id: deal.id,
        offer_id: deal.offerId,
        payment_id: payment.id,
      },
    });

    if (result.code !== 100 || !result.authority) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          errorMessage: result.message || `خطای زرین‌پال (${result.code})`,
        },
      });
      throw new BadRequestException(
        result.message || 'خطا در ایجاد درخواست پرداخت زرین‌پال',
      );
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        authority: result.authority,
        status: PaymentStatus.PENDING,
        errorMessage: null,
      },
    });

    return {
      success: true,
      paymentId: updated.id,
      authority: result.authority,
      paymentUrl: this.zarinpal.startPayUrl(result.authority),
      amountToman: updated.amountToman,
      amountRial: updated.amountRial,
      reused: false,
      sandbox: this.zarinpal.isSandbox(),
      status: updated.status,
    };
  }

  async getStatus(user: User, dealId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { payment: true },
    });
    if (!deal) throw new NotFoundException('همکاری پیدا نشد');
    if (deal.brandId !== user.id && deal.influencerId !== user.id) {
      throw new ForbiddenException('دسترسی ندارید');
    }

    const payment = deal.payment;
    const paid =
      payment?.status === PaymentStatus.HELD ||
      payment?.status === PaymentStatus.RELEASED;

    return {
      success: true,
      dealId: deal.id,
      offerId: deal.offerId,
      dealStatus: deal.status,
      paid,
      paymentStatus: payment?.status ?? null,
      refId: payment?.refId ?? null,
      amountToman: payment?.amountToman ?? deal.fee,
    };
  }

  async getByDeal(user: User, dealId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { payment: true },
    });
    if (!deal) throw new NotFoundException('همکاری پیدا نشد');
    if (deal.brandId !== user.id && deal.influencerId !== user.id) {
      throw new ForbiddenException('دسترسی ندارید');
    }
    if (!deal.payment) throw new NotFoundException('پرداخت پیدا نشد');
    return this.toPublic(deal.payment);
  }

  /**
   * ZarinPal browser callback (no JWT).
   * Verifies payment, activates deal, redirects to frontend result page.
   */
  async handleCallback(authority: string, status: string) {
    const auth = authority.trim();
    if (!auth) {
      return this.zarinpal.frontendResultUrl({
        ok: '0',
        error: 'missing_authority',
      });
    }

    if (String(status).toUpperCase() !== 'OK') {
      await this.prisma.payment.updateMany({
        where: { authority: auth, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.FAILED,
          errorMessage: 'پرداخت لغو شد یا انجام نشد',
        },
      });
      const failed = await this.prisma.payment.findFirst({
        where: { authority: auth },
        include: { deal: true },
      });
      if (failed) {
        await this.emitChatEvent(
          failed.deal.offerId,
          failed.brandId,
          MessageKind.SYSTEM,
          'پرداخت ناموفق بود',
          {
            event: 'PAYMENT_FAILED',
            paymentId: failed.id,
            dealId: failed.dealId,
          },
        );
        await this.notifications.create(
          failed.brandId,
          NotificationType.PAYMENT_FAILED,
          'پرداخت ناموفق',
          'پرداخت زرین‌پال لغو شد یا انجام نشد',
          `/app/messages/${failed.deal.offerId}`,
          failed.id,
        );
      }
      return this.zarinpal.frontendResultUrl({
        ok: '0',
        offerId: failed?.deal.offerId ?? '',
        dealId: failed?.dealId ?? '',
        error: 'cancelled',
      });
    }

    const payment = await this.prisma.payment.findFirst({
      where: { authority: auth },
      include: {
        deal: { include: { campaign: { select: { title: true } } } },
      },
    });
    if (!payment) {
      return this.zarinpal.frontendResultUrl({ ok: '0', error: 'not_found' });
    }

    // Idempotent: already held/released
    if (
      payment.status === PaymentStatus.HELD ||
      payment.status === PaymentStatus.RELEASED
    ) {
      return this.zarinpal.frontendResultUrl({
        ok: '1',
        offerId: payment.deal.offerId,
        dealId: payment.dealId,
        refId: payment.refId ?? '',
      });
    }

    const verify = await this.zarinpal.verifyPayment({
      amountRial: payment.amountRial,
      authority: auth,
    });

    // 100 = success, 101 = already verified
    if (verify.code !== 100 && verify.code !== 101) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          errorMessage: verify.message || `تایید ناموفق (${verify.code})`,
        },
      });
      await this.emitChatEvent(
        payment.deal.offerId,
        payment.brandId,
        MessageKind.SYSTEM,
        'تایید پرداخت ناموفق بود',
        {
          event: 'PAYMENT_FAILED',
          paymentId: payment.id,
          dealId: payment.dealId,
        },
      );
      return this.zarinpal.frontendResultUrl({
        ok: '0',
        offerId: payment.deal.offerId,
        dealId: payment.dealId,
        error: 'verify_failed',
      });
    }

    const refId = verify.refId || payment.refId || 'verified';

    // Atomic-ish: only move PENDING → HELD once
    const updated = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.HELD,
        refId,
        cardPan: verify.cardPan ?? null,
        paidAt: new Date(),
        errorMessage: null,
      },
    });

    if (updated.count === 1) {
      await this.prisma.deal.update({
        where: { id: payment.dealId },
        data: { status: DealStatus.IN_PROGRESS },
      });

      await this.wallets.holdEscrowFromGateway({
        brandId: payment.brandId,
        amountToman: payment.amountToman,
        dealId: payment.dealId,
        paymentId: payment.id,
        description: `امانی کمپین «${payment.deal.campaign.title}»`,
      });

      const title = payment.deal.campaign.title;
      await this.notifications.create(
        payment.influencerId,
        NotificationType.DEAL_STARTED,
        'همکاری شروع شد',
        `برند پرداخت کرد و همکاری کمپین «${title}» شروع شد`,
        `/app/messages/${payment.deal.offerId}`,
        payment.dealId,
      );
      await this.notifications.create(
        payment.brandId,
        NotificationType.PAYMENT_HELD,
        'پرداخت موفق',
        `مبلغ ${payment.amountToman.toLocaleString('fa-IR')} تومان در حساب امانی قرار گرفت`,
        `/app/messages/${payment.deal.offerId}`,
        payment.id,
      );

      await this.emitChatEvent(
        payment.deal.offerId,
        payment.brandId,
        MessageKind.SYSTEM,
        `پرداخت موفق · ${payment.amountToman.toLocaleString('fa-IR')} تومان · کد ${refId}`,
        {
          event: 'PAYMENT_HELD',
          paymentId: payment.id,
          dealId: payment.dealId,
          refId,
          amountToman: payment.amountToman,
        },
      );
      await this.emitChatEvent(
        payment.deal.offerId,
        payment.brandId,
        MessageKind.SYSTEM,
        `همکاری آغاز شد · ${payment.amountToman.toLocaleString('fa-IR')} تومان`,
        { event: 'DEAL_STARTED', dealId: payment.dealId },
      );
    }

    return this.zarinpal.frontendResultUrl({
      ok: '1',
      offerId: payment.deal.offerId,
      dealId: payment.dealId,
      refId,
    });
  }

  async markReleased(dealId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { dealId },
    });
    if (!payment || payment.status !== PaymentStatus.HELD) return null;

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.RELEASED,
        releasedAt: new Date(),
      },
    });

    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { campaign: { select: { title: true } } },
    });

    await this.wallets.releaseEscrowToInfluencer({
      brandId: payment.brandId,
      influencerId: payment.influencerId,
      amountToman: payment.amountToman,
      dealId,
      paymentId: payment.id,
      campaignTitle: deal?.campaign.title,
    });

    if (deal) {
      await this.notifications.create(
        deal.influencerId,
        NotificationType.PAYMENT_RELEASED,
        'آزادسازی مبلغ',
        `مبلغ همکاری کمپین «${deal.campaign.title}» به کیف پول شما واریز شد`,
        `/app/wallet`,
        payment.id,
      );
      await this.notifications.create(
        deal.influencerId,
        NotificationType.WALLET_CREDITED,
        'اعتبار کیف پول',
        `${payment.amountToman.toLocaleString('fa-IR')} تومان به موجودی قابل برداشت اضافه شد`,
        `/app/wallet`,
        payment.id,
      );
      await this.emitChatEvent(
        deal.offerId,
        deal.brandId,
        MessageKind.SYSTEM,
        `مبلغ آزاد شد · ${payment.amountToman.toLocaleString('fa-IR')} تومان → کیف پول اینفلوئنسر`,
        {
          event: 'PAYMENT_RELEASED',
          paymentId: payment.id,
          dealId,
          amountToman: payment.amountToman,
        },
      );
    }

    return this.toPublic(updated);
  }

  async markRefunded(dealId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { dealId },
    });
    if (!payment) return null;

    if (payment.status === PaymentStatus.PENDING) {
      return this.toPublic(
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            errorMessage: 'همکاری قبل از پرداخت لغو شد',
          },
        }),
      );
    }

    if (payment.status === PaymentStatus.HELD) {
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          errorMessage: 'همکاری لغو شد — مبلغ به کیف پول برند برگشت',
        },
      });
      await this.wallets.refundEscrowToBrand({
        brandId: payment.brandId,
        amountToman: payment.amountToman,
        dealId,
        paymentId: payment.id,
      });
      return this.toPublic(updated);
    }

    return this.toPublic(payment);
  }

  /**
   * After the canceller re-enables a deal: restore PENDING payment, or
   * re-hold escrow from the brand wallet if the fee had already been paid.
   */
  async restoreAfterReactivate(dealId: string, restoreStatus: DealStatus) {
    const payment = await this.prisma.payment.findUnique({
      where: { dealId },
    });
    if (!payment) {
      if (restoreStatus === DealStatus.PENDING_PAYMENT) return null;
      throw new BadRequestException('این همکاری قابل ازسرگیری نیست');
    }

    if (restoreStatus === DealStatus.PENDING_PAYMENT) {
      if (
        payment.status === PaymentStatus.FAILED ||
        payment.status === PaymentStatus.PENDING
      ) {
        return this.toPublic(
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.PENDING, errorMessage: null },
          }),
        );
      }
      return this.toPublic(payment);
    }

    if (payment.status === PaymentStatus.HELD) {
      return this.toPublic(payment);
    }

    if (
      payment.status === PaymentStatus.REFUNDED ||
      payment.status === PaymentStatus.FAILED
    ) {
      try {
        await this.wallets.holdEscrowFromBalance({
          brandId: payment.brandId,
          amountToman: payment.amountToman,
          dealId,
          paymentId: payment.id,
        });
      } catch (err) {
        if (err instanceof BadRequestException) {
          throw new BadRequestException(
            'موجودی کیف پول برند برای ازسرگیری همکاری کافی نیست',
          );
        }
        throw err;
      }

      return this.toPublic(
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.HELD,
            errorMessage: null,
          },
        }),
      );
    }

    throw new BadRequestException('این همکاری قابل ازسرگیری نیست');
  }
}
