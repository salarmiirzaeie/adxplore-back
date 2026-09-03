import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  NotificationType,
  UserRole,
  type User,
} from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { WalletsService } from './wallets.service';
import { assertInfluencerApproved } from '../common/influencer-approval';
import { UpsertBankCardDto } from './dto/upsert-bank-card.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import {
  BankCardEnvelopeResponse,
  BankCardResponse,
  WalletResponse,
  WithdrawResponse,
} from './dto/wallet-response';

@ApiTags('wallets')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my wallet balances and saved bank card' })
  @ApiOkResponse({ type: WalletResponse })
  me(@CurrentUser() user: User) {
    return this.wallets.getMine(user.id);
  }

  @Get('me/bank-card')
  @ApiOperation({ summary: 'Get my saved bank card (null if none)' })
  @ApiOkResponse({ type: BankCardEnvelopeResponse })
  getBankCard(@CurrentUser() user: User) {
    return this.wallets.getBankCard(user.id);
  }

  @Put('me/bank-card')
  @ApiOperation({ summary: 'Save or edit my bank card for payouts' })
  @ApiOkResponse({ type: BankCardResponse })
  upsertBankCard(@CurrentUser() user: User, @Body() dto: UpsertBankCardDto) {
    return this.wallets.upsertBankCard(user.id, dto);
  }

  @Get('me/transactions')
  @ApiOperation({ summary: 'List my wallet ledger' })
  transactions(@CurrentUser() user: User, @Query('take') take?: string) {
    const n = take ? Number(take) : 50;
    return this.wallets.listTransactions(user.id, Number.isFinite(n) ? n : 50);
  }

  @Post('me/withdraw')
  @ApiOperation({
    summary:
      'Influencer payout request (requires saved bank card; available → held until paid out)',
  })
  @ApiOkResponse({ type: WithdrawResponse })
  async withdraw(@CurrentUser() user: User, @Body() dto: WithdrawDto) {
    if (user.role !== UserRole.INFLUENCER) {
      throw new BadRequestException('فقط اینفلوئنسر می‌تواند برداشت کند');
    }
    assertInfluencerApproved(user);
    const result = await this.wallets.requestWithdraw(user.id, dto.amountToman);
    await this.notifications.create(
      user.id,
      NotificationType.WALLET_WITHDRAW_REQUESTED,
      'درخواست برداشت ثبت شد',
      `درخواست برداشت ${dto.amountToman.toLocaleString('fa-IR')} تومان ثبت شد`,
      '/app/wallet',
      result.transaction.id,
    );
    return result;
  }
}
