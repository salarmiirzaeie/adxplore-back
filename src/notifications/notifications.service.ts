import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  type User,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  toPublic(n: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    linkPath: string | null;
    entityId: string | null;
    readAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      linkPath: n.linkPath,
      entityId: n.entityId,
      readAt: n.readAt,
      createdAt: n.createdAt,
    };
  }

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    linkPath?: string | null,
    entityId?: string | null,
  ) {
    const n = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        linkPath: linkPath ?? null,
        entityId: entityId ?? null,
      },
    });
    return this.toPublic(n);
  }

  async listMine(user: User) {
    const items = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((n) => this.toPublic(n));
  }

  async unreadCount(user: User) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return { count };
  }

  async markRead(user: User, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) {
      throw new NotFoundException('اعلان پیدا نشد');
    }
    if (n.userId !== user.id) {
      throw new ForbiddenException('دسترسی به این اعلان ندارید');
    }
    if (n.readAt) {
      return this.toPublic(n);
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.toPublic(updated);
  }

  async markAllRead(user: User) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
