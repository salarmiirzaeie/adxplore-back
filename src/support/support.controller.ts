import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { User } from '../generated/prisma/client';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { SupportTicketResponse } from './dto/support-ticket-response';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth('access-token')
@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a support message from the panel' })
  @ApiCreatedResponse({ type: SupportTicketResponse })
  create(@CurrentUser() user: User, @Body() dto: CreateSupportTicketDto) {
    return this.support.create(user, dto);
  }
}
