import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { User } from '../generated/prisma/client';
import {
  PaymentRequestResponse,
  PaymentResponse,
  PaymentStatusResponse,
} from './dto/payment-response';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('callback')
  @ApiOperation({
    summary:
      'ZarinPal return URL (public). Verifies payment and redirects to frontend.',
  })
  async callback(
    @Query('Authority') authority: string,
    @Query('Status') status: string,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.payments.handleCallback(
      authority ?? '',
      status ?? '',
    );
    return res.redirect(302, redirectUrl);
  }

  @Post('deals/:dealId/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Start ZarinPal payment for a PENDING_PAYMENT deal (brand only). Returns paymentUrl.',
  })
  @ApiOkResponse({ type: PaymentRequestResponse })
  request(@CurrentUser() user: User, @Param('dealId') dealId: string) {
    return this.payments.requestForDeal(user, dealId);
  }

  @Get('deals/:dealId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Poll payment / deal paid status' })
  @ApiOkResponse({ type: PaymentStatusResponse })
  status(@CurrentUser() user: User, @Param('dealId') dealId: string) {
    return this.payments.getStatus(user, dealId);
  }

  @Get('deals/:dealId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get payment record for a deal' })
  @ApiOkResponse({ type: PaymentResponse })
  getOne(@CurrentUser() user: User, @Param('dealId') dealId: string) {
    return this.payments.getByDeal(user, dealId);
  }
}
