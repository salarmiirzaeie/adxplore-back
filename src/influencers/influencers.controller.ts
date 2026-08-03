import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { User } from '../generated/prisma/client';
import { InfluencerCardResponse } from './dto/influencer-card-response';
import { ListInfluencersQueryDto } from './dto/list-influencers-query.dto';
import { InfluencersService } from './influencers.service';

@ApiTags('influencers')
@ApiBearerAuth('access-token')
@Controller('influencers')
@UseGuards(JwtAuthGuard)
export class InfluencersController {
  constructor(private readonly influencers: InfluencersService) {}

  @Get()
  @ApiOperation({ summary: 'Browse influencers (brand only)' })
  @ApiOkResponse({ type: InfluencerCardResponse, isArray: true })
  list(@CurrentUser() user: User, @Query() query: ListInfluencersQueryDto) {
    return this.influencers.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get influencer public card (brand only)' })
  @ApiOkResponse({ type: InfluencerCardResponse })
  getOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.influencers.getOne(user, id);
  }
}
