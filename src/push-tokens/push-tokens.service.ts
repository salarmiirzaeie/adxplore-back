import { Injectable } from '@nestjs/common';
import { PushPlatform, type User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    user: User,
    token: string,
    platform: PushPlatform = PushPlatform.WEB,
  ) {
    const row = await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId: user.id, token, platform },
      update: { userId: user.id, platform },
    });
    return { id: row.id, token: row.token, platform: row.platform };
  }

  async remove(user: User, token: string) {
    await this.prisma.pushToken.deleteMany({
      where: { userId: user.id, token },
    });
    return { ok: true };
  }
}
