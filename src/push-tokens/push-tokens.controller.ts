import { Body, Controller, Delete, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushPlatform, type User } from '../generated/prisma/client';
import { PushTokenResponse } from './dto/push-token-response';
import { UpsertPushTokenDto } from './dto/upsert-push-token.dto';
import { PushTokensService } from './push-tokens.service';

@ApiTags('push-tokens')
@ApiBearerAuth('access-token')
@Controller('push-tokens')
@UseGuards(JwtAuthGuard)
export class PushTokensController {
  constructor(private readonly pushTokens: PushTokensService) {}

  @Put()
  @ApiOperation({ summary: 'Register or refresh this device FCM token' })
  @ApiOkResponse({ type: PushTokenResponse })
  upsert(@CurrentUser() user: User, @Body() dto: UpsertPushTokenDto) {
    return this.pushTokens.upsert(
      user,
      dto.token,
      dto.platform ?? PushPlatform.WEB,
    );
  }

  @Delete()
  @ApiOperation({ summary: 'Unregister this device FCM token' })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  remove(@CurrentUser() user: User, @Body() dto: UpsertPushTokenDto) {
    return this.pushTokens.remove(user, dto.token);
  }
}
