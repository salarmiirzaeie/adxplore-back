import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { User } from '../generated/prisma/client';
import { UPLOAD_MEDIA_MAX_BYTES } from '../media/uploads.service';
import { DealsService } from './deals.service';
import { DealResponse } from './dto/deal-response';
import { SubmitDeliverableDto } from './dto/submit-deliverable.dto';
import { UpdateDealStatusDto } from './dto/update-deal-status.dto';

@ApiTags('deals')
@ApiBearerAuth('access-token')
@Controller('deals')
@UseGuards(JwtAuthGuard)
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  @ApiOperation({
    summary: 'List my deals (brand or influencer). Optional campaignId filter.',
  })
  @ApiQuery({ name: 'campaignId', required: false })
  @ApiOkResponse({ type: DealResponse, isArray: true })
  listMine(
    @CurrentUser() user: User,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.dealsService.listMine(user, campaignId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one deal (party only)' })
  @ApiOkResponse({ type: DealResponse })
  getOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.dealsService.getOne(user, id);
  }

  @Post(':id/deliverable')
  @ApiOperation({
    summary:
      'Submit deliverable (influencer). kind=LINK|IMAGE|VIDEO. Multipart: kind, contentUrl?, note?, file?, proof?',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['LINK', 'IMAGE', 'VIDEO'] },
        contentUrl: {
          type: 'string',
          example: 'https://www.instagram.com/p/ABC123/',
        },
        note: { type: 'string', example: 'ریلز طبق بریف آماده شد' },
        file: { type: 'string', format: 'binary' },
        proof: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOkResponse({ type: DealResponse })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'proof', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: UPLOAD_MEDIA_MAX_BYTES },
      },
    ),
  )
  submitDeliverable(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SubmitDeliverableDto,
    @UploadedFiles()
    files?: { file?: Express.Multer.File[]; proof?: Express.Multer.File[] },
  ) {
    return this.dealsService.submitDeliverable(user, id, dto, files);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update deal status: brand COMPLETED / REVISION_REQUESTED / CANCELLED (before content); influencer CANCELLED; canceller IN_PROGRESS to re-enable',
  })
  @ApiOkResponse({ type: DealResponse })
  updateStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateDealStatusDto,
  ) {
    return this.dealsService.updateStatus(user, id, dto);
  }
}
