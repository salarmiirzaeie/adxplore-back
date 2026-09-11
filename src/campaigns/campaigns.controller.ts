import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { User } from '../generated/prisma/client';
import {
  CAMPAIGN_MAX_IMAGES,
  UPLOAD_MAX_BYTES,
} from '../media/uploads.service';
import { CampaignsService } from './campaigns.service';
import { BrowseCampaignsQueryDto } from './dto/browse-campaigns-query.dto';
import { CampaignResponse } from './dto/campaign-response';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ReorderCampaignImagesDto } from './dto/reorder-campaign-images.dto';
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

  @Get('browse')
  @ApiOperation({
    summary:
      'Browse approved OPEN campaigns in Explore (influencer). Filters: category, city, q, forMe, invited',
  })
  @ApiOkResponse({ type: CampaignResponse, isArray: true })
  browse(@CurrentUser() user: User, @Query() query: BrowseCampaignsQueryDto) {
    return this.campaigns.browseOpen(user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get campaign (brand owner, or influencer if approved OPEN marketplace campaign)',
  })
  @ApiOkResponse({ type: CampaignResponse })
  getOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.campaigns.getOne(user, id);
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

  @Post(':id/images')
  @ApiOperation({ summary: 'Upload campaign images (brand owner)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  @ApiOkResponse({ type: CampaignResponse })
  @UseInterceptors(
    FilesInterceptor('files', CAMPAIGN_MAX_IMAGES, {
      storage: memoryStorage(),
      limits: { fileSize: UPLOAD_MAX_BYTES },
    }),
  )
  addImages(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.campaigns.addImages(user, id, files);
  }

  @Patch(':id/images/order')
  @ApiOperation({ summary: 'Reorder campaign images (brand owner)' })
  @ApiOkResponse({ type: CampaignResponse })
  reorderImages(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ReorderCampaignImagesDto,
  ) {
    return this.campaigns.reorderImages(user, id, dto.imageIds);
  }

  @Delete(':id/images/:imageId')
  @ApiOperation({ summary: 'Delete a campaign image (brand owner)' })
  @ApiOkResponse({ type: CampaignResponse })
  removeImage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.campaigns.removeImage(user, id, imageId);
  }
}
