import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  WalletTxType,
  type BankCard,
  type Wallet,
  type WalletTransaction,
} from '../generated/prisma/client';
import {
  parseBankCardInput,
  toBankCardPublic,
  type BankCardPublic,
  type ParsedBankCard,
} from '../common/iran-bank-card';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertBankCardDto } from './dto/upsert-bank-card.dto';

type WalletWithCard = Wallet & { bankCard: BankCard | null };

type PayoutSnapshot = ParsedBankCard;

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  toBankCardPublic(card: BankCard | PayoutSnapshot): BankCardPublic {
    return toBankCardPublic(card);
  }

  toPublic(wallet: Wallet & { bankCard?: BankCard | null }) {
    const bankCard = wallet.bankCard
      ? this.toBankCardPublic(wallet.bankCard)
      : null;
    return {
      id: wallet.id,
      userId: wallet.userId,
      availableToman: wallet.availableToman,
      heldToman: wallet.heldToman,
      totalToman: wallet.availableToman + wallet.heldToman,
      hasBankCard: Boolean(wallet.bankCard),
      bankCard,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  toTxPublic(
    tx: WalletTransaction & {
      payoutHolderName?: string | null;
      payoutCardNumber?: string | null;
      payoutSheba?: string | null;
      payoutBankName?: string | null;
    },
  ) {
    const bankCard =
      tx.payoutHolderName &&
      tx.payoutCardNumber &&
      tx.payoutSheba &&
      tx.payoutBankName
        ? this.toBankCardPublic({
            holderName: tx.payoutHolderName,
            cardNumber: tx.payoutCardNumber,
            sheba: tx.payoutSheba,
            bankName: tx.payoutBankName,
          })
        : null;
    return {
      id: tx.id,
      walletId: tx.walletId,
      type: tx.type,
      amountToman: tx.amountToman,
      availableAfter: tx.availableAfter,
      heldAfter: tx.heldAfter,
      dealId: tx.dealId,
      paymentId: tx.paymentId,
      description: tx.description,
      bankCard,
      createdAt: tx.createdAt,
    };
  }

  async getOrCreate(userId: string): Promise<WalletWithCard> {
    const existing = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { bankCard: true },
    });
    if (existing) return existing;
    return this.prisma.wallet.create({
      data: { userId, availableToman: 0, heldToman: 0 },
      include: { bankCard: true },
    });
  }

  async getMine(userId: string) {
    return this.toPublic(await this.getOrCreate(userId));
  }

  async getBankCard(userId: string) {
    const wallet = await this.getOrCreate(userId);
    return {
      bankCard: wallet.bankCard
        ? this.toBankCardPublic(wallet.bankCard)
        : null,
    };
  }

  async upsertBankCard(userId: string, dto: UpsertBankCardDto) {
    const parsed = parseBankCardInput(dto);
    const wallet = await this.getOrCreate(userId);
    const card = await this.prisma.bankCard.upsert({
      where: { walletId: wallet.id },
      create: {
        walletId: wallet.id,
        holderName: parsed.holderName,
        cardNumber: parsed.cardNumber,
        sheba: parsed.sheba,
        bankName: parsed.bankName,
      },
      update: {
        holderName: parsed.holderName,
        cardNumber: parsed.cardNumber,
        sheba: parsed.sheba,
        bankName: parsed.bankName,
      },
    });
    return this.toBankCardPublic(card);
  }

  async listTransactions(userId: string, take = 50) {
    const wallet = await this.getOrCreate(userId);
    const items = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
    });
    return items.map((t) => this.toTxPublic(t));
  }

  /** Brand paid via ZarinPal → lock in brand held (escrow). */
  async holdEscrowFromGateway(params: {
    brandId: string;
    amountToman: number;
    dealId: string;
    paymentId: string;
    description?: string;
  }) {
    return this.apply(params.brandId, {
      type: WalletTxType.ESCROW_HOLD,
      amountToman: params.amountToman,
      deltaAvailable: 0,
      deltaHeld: params.amountToman,
      dealId: params.dealId,
      paymentId: params.paymentId,
      description:
        params.description ??
        `واریز امانی · ${params.amountToman.toLocaleString('fa-IR')} تومان`,
    });
  }

  /** Pay deal from brand available balance. */
  async holdEscrowFromBalance(params: {
    brandId: string;
    amountToman: number;
    dealId: string;
    paymentId: string;
  }) {
    const wallet = await this.getOrCreate(params.brandId);
    if (wallet.availableToman < params.amountToman) {
      throw new BadRequestException('موجودی کیف پول کافی نیست');
    }
    return this.apply(params.brandId, {
      type: WalletTxType.ESCROW_HOLD,
      amountToman: params.amountToman,
      deltaAvailable: -params.amountToman,
      deltaHeld: params.amountToman,
      dealId: params.dealId,
      paymentId: params.paymentId,
      description: `پرداخت از کیف پول · ${params.amountToman.toLocaleString('fa-IR')} تومان`,
    });
  }

  /** Deal completed: brand held ↓, influencer available ↑ */
  async releaseEscrowToInfluencer(params: {
    brandId: string;
    influencerId: string;
    amountToman: number;
    dealId: string;
    paymentId: string;
    campaignTitle?: string;
  }) {
    await this.apply(params.brandId, {
      type: WalletTxType.ESCROW_RELEASE,
      amountToman: params.amountToman,
      deltaAvailable: 0,
      deltaHeld: -params.amountToman,
      dealId: params.dealId,
      paymentId: params.paymentId,
      description: 'آزادسازی امانی به اینفلوئنسر',
    });

    return this.apply(params.influencerId, {
      type: WalletTxType.DEAL_EARNING,
      amountToman: params.amountToman,
      deltaAvailable: params.amountToman,
      deltaHeld: 0,
      dealId: params.dealId,
      paymentId: params.paymentId,
      description: params.campaignTitle
        ? `درآمد همکاری «${params.campaignTitle}»`
        : 'درآمد همکاری',
    });
  }

  /** Cancel after hold: brand held → available */
  async refundEscrowToBrand(params: {
    brandId: string;
    amountToman: number;
    dealId: string;
    paymentId: string;
  }) {
    return this.apply(params.brandId, {
      type: WalletTxType.ESCROW_REFUND,
      amountToman: params.amountToman,
      deltaAvailable: params.amountToman,
      deltaHeld: -params.amountToman,
      dealId: params.dealId,
      paymentId: params.paymentId,
      description: 'بازگشت وجه امانی به کیف پول',
    });
  }

  async creditTopUp(params: {
    userId: string;
    amountToman: number;
    paymentId?: string;
    description?: string;
  }) {
    return this.apply(params.userId, {
      type: WalletTxType.TOP_UP,
      amountToman: params.amountToman,
      deltaAvailable: params.amountToman,
      deltaHeld: 0,
      paymentId: params.paymentId,
      description:
        params.description ??
        `شارژ کیف پول · ${params.amountToman.toLocaleString('fa-IR')} تومان`,
    });
  }

  async requestWithdraw(userId: string, amountToman: number) {
    if (amountToman < 10_000) {
      throw new BadRequestException('حداقل برداشت ۱۰٬۰۰۰ تومان است');
    }
    const wallet = await this.getOrCreate(userId);
    if (!wallet.bankCard) {
      throw new BadRequestException(
        'برای برداشت ابتدا کارت بانکی خود را ثبت کنید',
      );
    }
    if (wallet.availableToman < amountToman) {
      throw new BadRequestException('موجودی قابل برداشت کافی نیست');
    }
    const card = wallet.bankCard;
    return this.apply(userId, {
      type: WalletTxType.WITHDRAW_REQUEST,
      amountToman,
      deltaAvailable: -amountToman,
      deltaHeld: amountToman,
      payout: {
        holderName: card.holderName,
        cardNumber: card.cardNumber,
        sheba: card.sheba,
        bankName: card.bankName,
      },
      description: `درخواست برداشت · ${amountToman.toLocaleString('fa-IR')} تومان · ${card.bankName} ****${card.cardNumber.slice(-4)}`,
    });
  }

  /** Admin: bank transfer done → clear held. Links via relatedTxId = request tx id. */
  async completeWithdraw(requestTxId: string) {
    const request = await this.requireOpenWithdrawRequest(requestTxId);
    return this.apply(request.wallet.userId, {
      type: WalletTxType.WITHDRAW_DONE,
      amountToman: request.amountToman,
      deltaAvailable: 0,
      deltaHeld: -request.amountToman,
      relatedTxId: request.id,
      description: `برداشت انجام شد · ${request.amountToman.toLocaleString('fa-IR')} تومان`,
    });
  }

  /** Admin: reject request → held back to available. */
  async rejectWithdraw(requestTxId: string) {
    const request = await this.requireOpenWithdrawRequest(requestTxId);
    return this.apply(request.wallet.userId, {
      type: WalletTxType.WITHDRAW_CANCEL,
      amountToman: request.amountToman,
      deltaAvailable: request.amountToman,
      deltaHeld: -request.amountToman,
      relatedTxId: request.id,
      description: `برداشت رد شد · ${request.amountToman.toLocaleString('fa-IR')} تومان`,
    });
  }

  async listWithdrawRequests(status: 'pending' | 'all' = 'pending') {
    const requests = await this.prisma.walletTransaction.findMany({
      where: { type: WalletTxType.WITHDRAW_REQUEST },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        wallet: {
          include: {
            bankCard: true,
            user: {
              select: {
                id: true,
                phone: true,
                name: true,
                role: true,
              },
            },
          },
        },
      },
    });

    const settled = await this.prisma.walletTransaction.findMany({
      where: {
        type: {
          in: [WalletTxType.WITHDRAW_DONE, WalletTxType.WITHDRAW_CANCEL],
        },
        relatedTxId: { in: requests.map((r) => r.id) },
      },
      select: { relatedTxId: true, type: true, createdAt: true },
    });
    const settledByRequest = new Map(
      settled
        .filter((s): s is typeof s & { relatedTxId: string } => !!s.relatedTxId)
        .map((s) => [s.relatedTxId, s]),
    );

    const items = requests.map((r) => {
      const settle = settledByRequest.get(r.id);
      const settleStatus = settle
        ? settle.type === WalletTxType.WITHDRAW_DONE
          ? ('completed' as const)
          : ('rejected' as const)
        : ('pending' as const);
      const snapshot =
        r.payoutHolderName &&
        r.payoutCardNumber &&
        r.payoutSheba &&
        r.payoutBankName
          ? this.toBankCardPublic({
              holderName: r.payoutHolderName,
              cardNumber: r.payoutCardNumber,
              sheba: r.payoutSheba,
              bankName: r.payoutBankName,
            })
          : r.wallet.bankCard
            ? this.toBankCardPublic(r.wallet.bankCard)
            : null;
      return {
        id: r.id,
        amountToman: r.amountToman,
        description: r.description,
        createdAt: r.createdAt,
        status: settleStatus,
        settledAt: settle?.createdAt ?? null,
        user: r.wallet.user,
        bankCard: snapshot,
        wallet: {
          id: r.wallet.id,
          availableToman: r.wallet.availableToman,
          heldToman: r.wallet.heldToman,
        },
      };
    });

    if (status === 'pending') {
      return items.filter((i) => i.status === 'pending');
    }
    return items;
  }

  private async requireOpenWithdrawRequest(requestTxId: string) {
    const request = await this.prisma.walletTransaction.findUnique({
      where: { id: requestTxId },
      include: { wallet: true },
    });
    if (!request || request.type !== WalletTxType.WITHDRAW_REQUEST) {
      throw new NotFoundException('درخواست برداشت پیدا نشد');
    }
    const settled = await this.prisma.walletTransaction.findFirst({
      where: {
        relatedTxId: request.id,
        type: {
          in: [WalletTxType.WITHDRAW_DONE, WalletTxType.WITHDRAW_CANCEL],
        },
      },
    });
    if (settled) {
      throw new BadRequestException('این درخواست قبلاً رسیدگی شده است');
    }
    if (request.wallet.heldToman < request.amountToman) {
      throw new BadRequestException('موجودی رزرو برداشت کافی نیست');
    }
    return request;
  }

  private async apply(
    userId: string,
    input: {
      type: WalletTxType;
      amountToman: number;
      deltaAvailable: number;
      deltaHeld: number;
      dealId?: string;
      paymentId?: string;
      relatedTxId?: string;
      description?: string;
      payout?: PayoutSnapshot;
    },
  ) {
    const wallet = await this.getOrCreate(userId);
    const availableToman = wallet.availableToman + input.deltaAvailable;
    const heldToman = wallet.heldToman + input.deltaHeld;
    if (availableToman < 0 || heldToman < 0) {
      throw new BadRequestException('موجودی کیف پول نامعتبر می‌شود');
    }

    const [updated, tx] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { availableToman, heldToman },
        include: { bankCard: true },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: input.type,
          amountToman: input.amountToman,
          availableAfter: availableToman,
          heldAfter: heldToman,
          dealId: input.dealId,
          paymentId: input.paymentId,
          relatedTxId: input.relatedTxId,
          description: input.description,
          payoutHolderName: input.payout?.holderName,
          payoutCardNumber: input.payout?.cardNumber,
          payoutSheba: input.payout?.sheba,
          payoutBankName: input.payout?.bankName,
        },
      }),
    ]);

    return {
      wallet: this.toPublic(updated),
      transaction: this.toTxPublic(tx),
    };
  }
}
