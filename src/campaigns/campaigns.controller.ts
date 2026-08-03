import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { User } from '../generated/prisma/client';
import { CampaignsService } from './campaigns.service';
import { CampaignResponse } from './dto/campaign-response';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@ApiTags('campaigns')
@ApiBearerAuth('access-token')
@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a campaign (brand only)' })
  @ApiCreatedResponse({ type: CampaignResponse })
  create(@CurrentUser() user: User, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my campaigns (brand only)' })
  @ApiOkResponse({ type: CampaignResponse, isArray: true })
  list(@CurrentUser() user: User) {
    return this.campaigns.listMine(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign I own (brand only)' })
  @ApiOkResponse({ type: CampaignResponse })
  getOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.campaigns.getMine(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign I own (brand only)' })
  @ApiOkResponse({ type: CampaignResponse })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaigns.update(user, id, dto);
  }
}
