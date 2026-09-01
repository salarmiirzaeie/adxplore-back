import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  NotificationType,
  UserRole,
  type User,
} from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { WalletsService } from './wallets.service';

class WithdrawDto {
  @ApiProperty({ example: 500_000 })
  @Type(() => Number)
  @IsInt()
  @Min(10_000)
  amountToman!: number;
}

class WalletResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  availableToman!: number;

  @ApiProperty()
  heldToman!: number;

  @ApiProperty()
  totalToman!: number;
}

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
  @ApiOperation({ summary: 'Get my wallet balances' })
  @ApiOkResponse({ type: WalletResponseDto })
  me(@CurrentUser() user: User) {
    return this.wallets.getMine(user.id);
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
      'Influencer withdraw request (available → held until manually paid out)',
  })
  async withdraw(@CurrentUser() user: User, @Body() dto: WithdrawDto) {
    if (user.role !== UserRole.INFLUENCER) {
      throw new BadRequestException('فقط اینفلوئنسر می‌تواند برداشت کند');
    }
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
