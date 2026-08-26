import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { UPLOAD_MAX_BYTES } from '../uploads/uploads.service';
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
    summary:
      'List my deals (brand or influencer). Optional campaignId filter.',
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
      'Submit deliverable (influencer). Multipart: contentUrl, note?, proof? — or JSON body without file.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['contentUrl'],
      properties: {
        contentUrl: {
          type: 'string',
          example: 'https://www.instagram.com/p/ABC123/',
        },
        note: { type: 'string', example: 'ریلز طبق بریف آماده شد' },
        proof: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOkResponse({ type: DealResponse })
  @UseInterceptors(
    FileInterceptor('proof', {
      storage: memoryStorage(),
      limits: { fileSize: UPLOAD_MAX_BYTES },
    }),
  )
  submitDeliverable(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SubmitDeliverableDto,
    @UploadedFile() proof?: Express.Multer.File,
  ) {
    return this.dealsService.submitDeliverable(user, id, dto, proof);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update deal status: brand COMPLETED / REVISION_REQUESTED / CANCELLED; influencer CANCELLED',
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
