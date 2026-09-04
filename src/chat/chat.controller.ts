import {
  Body,
  Controller,
  Get,
  Param,
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
  ApiCreatedResponse,
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
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatMessageResponse, ConversationResponse } from './dto/chat-response';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('chat')
@ApiBearerAuth('access-token')
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my offer conversations' })
  @ApiOkResponse({ type: ConversationResponse, isArray: true })
  listMine(@CurrentUser() user: User) {
    return this.chat.listMine(user);
  }

  @Get('by-offer/:offerId')
  @ApiOperation({
    summary: 'Get or create conversation for an offer (party only)',
  })
  @ApiOkResponse({ type: ConversationResponse })
  byOffer(@CurrentUser() user: User, @Param('offerId') offerId: string) {
    return this.chat.getOrCreateByOfferId(user, offerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one conversation' })
  @ApiOkResponse({ type: ConversationResponse })
  getOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.chat.getOne(user, id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List messages (oldest → newest)' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'take', required: false })
  @ApiOkResponse({ type: ChatMessageResponse, isArray: true })
  listMessages(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.chat.listMessages(user, id, {
      cursor,
      take: take ? Number(take) : undefined,
    });
  }

  @Post(':id/messages')
  @ApiOperation({
    summary:
      'Send a message (REST). JSON { body } or multipart body? + file (image/video). Socket.io still supports text.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        body: { type: 'string', example: 'سلام' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: ChatMessageResponse })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: UPLOAD_MEDIA_MAX_BYTES },
    }),
  )
  async send(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const message = await this.chat.sendMessage(user, id, dto.body, file);
    this.gateway.emitNewMessage(id, message);
    return message;
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark messages as read' })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  markRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.chat.markRead(user.id, id);
  }
}
