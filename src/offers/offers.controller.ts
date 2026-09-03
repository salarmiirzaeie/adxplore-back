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
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferResponse } from './dto/offer-response';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import { UpdateOfferTermsDto } from './dto/update-offer-terms.dto';
import { OffersService } from './offers.service';

@ApiTags('offers')
@ApiBearerAuth('access-token')
@Controller('offers')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @ApiOperation({
    summary:
      'Send an offer on an OPEN campaign (influencer). Invitation optional. Creates a chat thread with the brand.',
  })
  @ApiCreatedResponse({ type: OfferResponse })
  create(@CurrentUser() user: User, @Body() dto: CreateOfferDto) {
    return this.offersService.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'List my offers (brand: received; influencer: sent). Optional campaignId filter.',
  })
  @ApiQuery({ name: 'campaignId', required: false })
  @ApiOkResponse({ type: OfferResponse, isArray: true })
  listMine(
    @CurrentUser() user: User,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.offersService.listMine(user, campaignId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one offer (party only)' })
  @ApiOkResponse({ type: OfferResponse })
  getOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.offersService.getOne(user, id);
  }

  @Patch(':id/terms')
  @ApiOperation({
    summary:
      'Edit pending offer fee/message/deadline (influencer). Allowed until the brand accepts or rejects.',
  })
  @ApiOkResponse({ type: OfferResponse })
  updateTerms(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateOfferTermsDto,
  ) {
    return this.offersService.updateTerms(user, id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update offer status: brand ACCEPTED/REJECTED; influencer CANCELLED',
  })
  @ApiOkResponse({ type: OfferResponse })
  updateStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateOfferStatusDto,
  ) {
    return this.offersService.updateStatus(user, id, dto);
  }
}
