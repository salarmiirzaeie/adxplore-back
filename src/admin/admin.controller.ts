import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Admin dashboard counters' })
  overview() {
    return this.admin.overview();
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'List withdrawal requests' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'all'],
  })
  listWithdrawals(@Query('status') status?: 'pending' | 'all') {
    return this.admin.listWithdrawals(status === 'all' ? 'all' : 'pending');
  }

  @Post('withdrawals/:id/complete')
  @ApiOperation({
    summary: 'Mark withdrawal as paid (after manual bank transfer)',
  })
  completeWithdrawal(@Param('id') id: string) {
    return this.admin.completeWithdrawal(id);
  }

  @Post('withdrawals/:id/reject')
  @ApiOperation({ summary: 'Reject withdrawal and unlock held balance' })
  rejectWithdrawal(@Param('id') id: string) {
    return this.admin.rejectWithdrawal(id);
  }

  @Get('deals')
  @ApiOperation({ summary: 'List recent deals' })
  @ApiQuery({ name: 'take', required: false })
  listDeals(@Query('take') take?: string) {
    return this.admin.listDeals(take ? Number(take) : 50);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List recent payments' })
  @ApiQuery({ name: 'take', required: false })
  listPayments(@Query('take') take?: string) {
    return this.admin.listPayments(take ? Number(take) : 50);
  }
}
