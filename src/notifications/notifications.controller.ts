import { Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { User } from '../generated/prisma/client';
import {
  NotificationResponse,
  UnreadCountResponse,
} from './dto/notification-response';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications' })
  @ApiOkResponse({ type: NotificationResponse, isArray: true })
  listMine(@CurrentUser() user: User) {
    return this.notifications.listMine(user);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count' })
  @ApiOkResponse({ type: UnreadCountResponse })
  unreadCount(@CurrentUser() user: User) {
    return this.notifications.unreadCount(user);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiOkResponse({ type: NotificationResponse })
  markRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  markAllRead(@CurrentUser() user: User) {
    return this.notifications.markAllRead(user);
  }
}
