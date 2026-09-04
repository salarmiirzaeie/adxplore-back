import { BadRequestException, Injectable } from '@nestjs/common';
import {
  SupportTicketStatus,
  type SupportTicket,
  type User,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';

const MAX_TICKETS_PER_HOUR = 5;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  toPublic(ticket: SupportTicket) {
    return {
      id: ticket.id,
      userId: ticket.userId,
      phone: ticket.phone,
      subject: ticket.subject,
      message: ticket.message,
      status: ticket.status,
      readAt: ticket.readAt,
      resolvedAt: ticket.resolvedAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }

  async create(user: User, dto: CreateSupportTicketDto) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await this.prisma.supportTicket.count({
      where: { userId: user.id, createdAt: { gte: since } },
    });
    if (recent >= MAX_TICKETS_PER_HOUR) {
      throw new BadRequestException(
        'لطفاً کمی صبر کنید و بعد دوباره پیام بفرستید',
      );
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId: user.id,
        phone: dto.phone,
        subject: dto.subject,
        message: dto.message,
        status: SupportTicketStatus.NEW,
      },
    });
    return this.toPublic(ticket);
  }
}
