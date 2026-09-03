import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { User } from '../generated/prisma/client';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { BulkCreateInvitationsDto } from './dto/bulk-create-invitations.dto';
import { InvitationResponse } from './dto/invitation-response';
import { UpdateInvitationStatusDto } from './dto/update-invitation-status.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@ApiBearerAuth('access-token')
@Controller('invitations')
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @ApiOperation({ summary: 'Invite an influencer to a campaign (brand only)' })
  @ApiCreatedResponse({ type: InvitationResponse })
  create(@CurrentUser() user: User, @Body() dto: CreateInvitationDto) {
    return this.invitations.create(user, dto);
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Invite multiple influencers to a campaign (brand only)',
  })
  createBulk(@CurrentUser() user: User, @Body() dto: BulkCreateInvitationsDto) {
    return this.invitations.createBulk(user, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'List invitations (brand: sent; influencer: received). Brand may filter by campaignId.',
  })
  @ApiQuery({ name: 'campaignId', required: false })
  @ApiOkResponse({ type: InvitationResponse, isArray: true })
  listMine(
    @CurrentUser() user: User,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.invitations.listMine(user, campaignId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one invitation (party only)' })
  @ApiOkResponse({ type: InvitationResponse })
  getOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.invitations.getOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cancel invitation (brand only, PENDING → CANCELLED)',
  })
  @ApiOkResponse({ type: InvitationResponse })
  updateStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateInvitationStatusDto,
  ) {
    return this.invitations.updateStatus(user, id, dto);
  }
}
