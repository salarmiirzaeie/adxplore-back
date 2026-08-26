import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

type AuthedSocket = Socket & { data: { userId?: string } };

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const raw =
        (client.handshake.auth?.token as string | undefined) ||
        (client.handshake.headers.authorization?.startsWith('Bearer ')
          ? client.handshake.headers.authorization.slice(7)
          : undefined);

      if (!raw) {
        client.disconnect(true);
        return;
      }

      const secret = this.config.get<string>('JWT_SECRET');
      if (!secret) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwt.verifyAsync<JwtPayload>(raw, { secret });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      if (!user) {
        client.disconnect(true);
        return;
      }

      client.data.userId = user.id;
      await client.join(`user:${user.id}`);
    } catch (err) {
      this.logger.warn(`Socket auth failed: ${String(err)}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('conversation:join')
  async join(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId?: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.conversationId) {
      return { ok: false, error: 'unauthorized' };
    }
    try {
      await this.chat.assertParticipant(data.conversationId, userId);
      await client.join(`conversation:${data.conversationId}`);
      await this.chat.markRead(userId, data.conversationId);
      return { ok: true };
    } catch {
      return { ok: false, error: 'forbidden' };
    }
  }

  @SubscribeMessage('conversation:leave')
  async leave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId?: string },
  ) {
    if (data?.conversationId) {
      await client.leave(`conversation:${data.conversationId}`);
    }
    return { ok: true };
  }

  @SubscribeMessage('message:send')
  async send(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId?: string; body?: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.conversationId || !data.body) {
      return { ok: false, error: 'invalid' };
    }

    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      const message = await this.chat.sendMessage(
        user,
        data.conversationId,
        data.body,
      );
      this.emitNewMessage(data.conversationId, message);
      return { ok: true, message };
    } catch {
      return { ok: false, error: 'send_failed' };
    }
  }

  emitNewMessage(conversationId: string, message: unknown) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('message:new', message);
  }
}
