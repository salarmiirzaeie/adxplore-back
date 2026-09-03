import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InfluencerApprovalStatus,
  UserRole,
  type Prisma,
  type User,
} from '../generated/prisma/client';
import { parseCategories, primaryCategory } from '../common/categories';
import { PrismaService } from '../prisma/prisma.service';
import { ListInfluencersQueryDto } from './dto/list-influencers-query.dto';

@Injectable()
export class InfluencersService {
  constructor(private readonly prisma: PrismaService) {}

  private assertBrand(user: User) {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException(
        'فقط برندها می‌توانند اینفلوئنسرها را ببینند',
      );
    }
  }

  toCard(user: User) {
    const categories = parseCategories(user.categories, user.category);
    return {
      id: user.id,
      name: user.name!,
      website: user.website!,
      photoUrl: user.photoUrl,
      category: primaryCategory(categories) ?? user.category!,
      categories,
      city: user.city!,
      province: user.province,
      followerRange: user.followerRange!,
    };
  }

  private isComplete(user: User) {
    const categories = parseCategories(user.categories, user.category);
    return Boolean(
      user.role === UserRole.INFLUENCER &&
      user.name?.trim() &&
      user.website?.trim() &&
      user.city?.trim() &&
      user.province?.trim() &&
      categories.length &&
      user.followerRange,
    );
  }

  async list(viewer: User, query: ListInfluencersQueryDto) {
    this.assertBrand(viewer);

    const where: Prisma.UserWhereInput = {
      role: UserRole.INFLUENCER,
      approvalStatus: InfluencerApprovalStatus.APPROVED,
      name: { not: null },
      website: { not: null },
      city: { not: null },
      province: { not: null },
      followerRange: { not: null },
      ...(query.category ? { category: query.category } : {}),
      ...(query.city ? { city: query.city } : {}),
      ...(query.province ? { province: query.province } : {}),
      ...(query.followerRange ? { followerRange: query.followerRange } : {}),
    };

    const influencers = await this.prisma.user.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return influencers
      .filter((u) => this.isComplete(u))
      .map((u) => this.toCard(u));
  }

  async getOne(viewer: User, id: string) {
    this.assertBrand(viewer);

    const influencer = await this.prisma.user.findFirst({
      where: {
        id,
        role: UserRole.INFLUENCER,
        approvalStatus: InfluencerApprovalStatus.APPROVED,
        name: { not: null },
        website: { not: null },
        city: { not: null },
        province: { not: null },
        followerRange: { not: null },
      },
    });

    if (!influencer || !this.isComplete(influencer)) {
      throw new NotFoundException('اینفلوئنسر پیدا نشد');
    }

    return this.toCard(influencer);
  }
}
