import {
  Body,
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
import {
  ListCampaignReviewsQueryDto,
  RejectCampaignDto,
} from './dto/campaign-review.dto';
import {
  ListInfluencerApprovalsQueryDto,
  RejectInfluencerDto,
} from './dto/influencer-approval.dto';

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

  @Get('influencers')
  @ApiOperation({
    summary:
      'Review influencer Instagram follow + DM codes before they can use the panel',
  })
  listInfluencerApprovals(@Query() query: ListInfluencerApprovalsQueryDto) {
    return this.admin.listInfluencerApprovals(query);
  }

  @Post('influencers/:id/approve')
  @ApiOperation({
    summary:
      'Approve influencer after confirming they followed @adxplore.ir and DMed the verify code',
  })
  approveInfluencer(@Param('id') id: string) {
    return this.admin.approveInfluencer(id);
  }

  @Post('influencers/:id/reject')
  @ApiOperation({
    summary: 'Reject influencer (they can follow/DM again and wait for review)',
  })
  rejectInfluencer(@Param('id') id: string, @Body() dto: RejectInfluencerDto) {
    return this.admin.rejectInfluencer(id, dto.reason);
  }

  @Get('campaigns')
  @ApiOperation({
    summary:
      'Review brand campaigns before they appear in Explore or invites are delivered',
  })
  listCampaigns(@Query() query: ListCampaignReviewsQueryDto) {
    return this.admin.listCampaignReviews(query);
  }

  @Post('campaigns/:id/approve')
  @ApiOperation({
    summary:
      'Approve campaign: it goes to Explore and queued invites are sent. No brand notification.',
  })
  approveCampaign(@Param('id') id: string) {
    return this.admin.approveCampaign(id);
  }

  @Post('campaigns/:id/reject')
  @ApiOperation({
    summary:
      'Reject campaign content. Brand is notified with the reason and can edit and resubmit.',
  })
  rejectCampaign(@Param('id') id: string, @Body() dto: RejectCampaignDto) {
    return this.admin.rejectCampaign(id, dto);
  }
}
