import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CampaignStatus,
  InfluencerApprovalStatus,
  UserRole,
  type User,
} from '../generated/prisma/client';
import {
  normalizeCategories,
  parseCategories,
  primaryCategory,
} from '../common/categories';
import { resolveProfileLocation } from '../common/cities';
import {
  influencerCanAccessPanel,
  influencerCanSendOffers,
  influencerNextScreen,
  isInfluencerProfileComplete,
} from '../common/influencer-approval';
import {
  buildInstagramApprovalPayload,
  DEFAULT_INSTAGRAM_PAGE_USERNAME,
  generateInstagramVerifyCode,
} from '../common/instagram';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../media/uploads.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly config: ConfigService,
  ) {}

  private pageUsername() {
    return (
      this.config.get<string>('INSTAGRAM_PAGE_USERNAME')?.trim() ||
      DEFAULT_INSTAGRAM_PAGE_USERNAME
    );
  }

  toPublic(user: User) {
    const categories = parseCategories(user.categories, user.category);
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      photoUrl: user.photoUrl,
      category: primaryCategory(categories) ?? user.category,
      categories,
      city: user.city,
      province: user.province,
      website: user.website,
      bio: user.bio,
      goal: user.goal,
      businessSize: user.businessSize,
      followerRange: user.followerRange,
      approvalStatus: user.approvalStatus,
      canAccessPanel: influencerCanAccessPanel(user),
      canSendOffers: influencerCanSendOffers(user),
      nextScreen: influencerNextScreen(user),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublic(user);
  }

  toMarketplaceProfile(user: User) {
    const categories = parseCategories(user.categories, user.category);
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      photoUrl: user.photoUrl,
      category: primaryCategory(categories) ?? user.category,
      categories,
      city: user.city,
      province: user.province,
      website: user.website,
      bio: user.bio,
      goal: user.role === UserRole.BRAND ? user.goal : null,
      businessSize: user.role === UserRole.BRAND ? user.businessSize : null,
      followerRange:
        user.role === UserRole.INFLUENCER ? user.followerRange : null,
    };
  }

  async getPublicProfile(viewer: User, id: string) {
    if (viewer.id === id) {
      return this.toMarketplaceProfile(viewer);
    }

    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.role === UserRole.ADMIN) {
      throw new NotFoundException('پروفایل پیدا نشد');
    }

    if (viewer.role === UserRole.ADMIN) {
      return this.toMarketplaceProfile(target);
    }

    const allowed = await this.canViewPublicProfile(viewer, target);
    if (!allowed) {
      throw new NotFoundException('پروفایل پیدا نشد');
    }

    return this.toMarketplaceProfile(target);
  }

  private async canViewPublicProfile(viewer: User, target: User) {
    if (
      viewer.role === UserRole.BRAND &&
      target.role === UserRole.INFLUENCER &&
      target.approvalStatus === InfluencerApprovalStatus.APPROVED &&
      isInfluencerProfileComplete(target)
    ) {
      return true;
    }

    if (viewer.role === UserRole.INFLUENCER && target.role === UserRole.BRAND) {
      const openCampaign = await this.prisma.campaign.findFirst({
        where: { brandId: target.id, status: CampaignStatus.OPEN },
        select: { id: true },
      });
      if (openCampaign) return true;
    }

    const pair = {
      OR: [
        { brandId: viewer.id, influencerId: target.id },
        { brandId: target.id, influencerId: viewer.id },
      ],
    };

    const [invitation, offer] = await Promise.all([
      this.prisma.invitation.findFirst({ where: pair, select: { id: true } }),
      this.prisma.offer.findFirst({ where: pair, select: { id: true } }),
    ]);

    return Boolean(invitation || offer);
  }

  async ensureInstagramVerifyCode(user: User): Promise<User> {
    if (user.role !== UserRole.INFLUENCER) return user;
    if (user.instagramVerifyCode) return user;
    if (!isInfluencerProfileComplete(user)) return user;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInstagramVerifyCode();
      try {
        return await this.prisma.user.update({
          where: { id: user.id },
          data: {
            instagramVerifyCode: code,
            ...(user.approvalStatus === InfluencerApprovalStatus.APPROVED
              ? {}
              : { approvalStatus: InfluencerApprovalStatus.PENDING }),
          },
        });
      } catch {
        /* unique collision — retry */
      }
    }

    throw new BadRequestException('نتوانستیم کد تأیید اینستاگرام بسازیم');
  }

  async getInstagramApproval(user: User) {
    if (user.role !== UserRole.INFLUENCER) {
      throw new BadRequestException('این مرحله فقط برای اینفلوئنسرها است');
    }
    const withCode = await this.ensureInstagramVerifyCode(user);
    return buildInstagramApprovalPayload({
      user: withCode,
      pageUsername: this.pageUsername(),
    });
  }

  async markInstagramDmSent(user: User) {
    if (user.role !== UserRole.INFLUENCER) {
      throw new BadRequestException('این مرحله فقط برای اینفلوئنسرها است');
    }
    if (!isInfluencerProfileComplete(user)) {
      throw new BadRequestException('ابتدا پروفایل را کامل کنید');
    }
    if (user.approvalStatus === InfluencerApprovalStatus.APPROVED) {
      throw new BadRequestException('حساب شما قبلاً تأیید شده است');
    }

    const withCode = await this.ensureInstagramVerifyCode(user);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        instagramDmMarkedSentAt: new Date(),
        approvalStatus: InfluencerApprovalStatus.PENDING,
        rejectedAt: null,
        rejectionReason: null,
      },
    });

    return buildInstagramApprovalPayload({
      user: { ...withCode, ...updated },
      pageUsername: this.pageUsername(),
    });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const existingCategories = parseCategories(
      existing.categories,
      existing.category,
    );
    const nextCategories =
      dto.categories !== undefined
        ? normalizeCategories(dto.categories)
        : dto.category !== undefined
          ? normalizeCategories([dto.category])
          : existingCategories;
    const nextPrimary = primaryCategory(nextCategories);

    const locationChanging =
      dto.city !== undefined || dto.province !== undefined;
    const resolvedLocation = locationChanging
      ? resolveProfileLocation(
          dto.city !== undefined ? dto.city : existing.city,
          dto.province !== undefined ? dto.province : existing.province,
        )
      : null;
    const nextCity = resolvedLocation ? resolvedLocation.city : existing.city;
    const nextProvince = resolvedLocation
      ? resolvedLocation.province
      : existing.province;

    if (existing.role === UserRole.BRAND) {
      const nextName = dto.name !== undefined ? dto.name.trim() : existing.name;

      if (
        !nextName?.trim() ||
        !nextPrimary ||
        !nextCity?.trim() ||
        !nextProvince?.trim()
      ) {
        throw new BadRequestException(
          'پروفایل برند باید شامل نام، دسته، استان و شهر باشد',
        );
      }
    }

    if (existing.role === UserRole.INFLUENCER) {
      const nextName = dto.name !== undefined ? dto.name.trim() : existing.name;
      const nextWebsite =
        dto.website !== undefined
          ? dto.website === null
            ? null
            : dto.website.trim() || null
          : existing.website;
      const nextFollowerRange =
        dto.followerRange !== undefined
          ? dto.followerRange
          : existing.followerRange;

      if (
        !nextName?.trim() ||
        !nextPrimary ||
        !nextCity?.trim() ||
        !nextProvince?.trim() ||
        !nextWebsite?.trim() ||
        !nextFollowerRange
      ) {
        throw new BadRequestException(
          'پروفایل اینفلوئنسر باید شامل نام، اینستاگرام، دسته، استان، شهر و بازه فالوور باشد',
        );
      }
    }

    const categoriesChanged =
      dto.categories !== undefined || dto.category !== undefined;

    let user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(categoriesChanged
          ? { category: nextPrimary, categories: nextCategories }
          : {}),
        ...(resolvedLocation
          ? { city: resolvedLocation.city, province: resolvedLocation.province }
          : {}),
        ...(dto.website !== undefined
          ? {
              website: dto.website === null ? null : dto.website.trim() || null,
            }
          : {}),
        ...(dto.bio !== undefined
          ? { bio: dto.bio === null ? null : dto.bio.trim() || null }
          : {}),
        ...(dto.goal !== undefined ? { goal: dto.goal } : {}),
        ...(dto.businessSize !== undefined
          ? { businessSize: dto.businessSize }
          : {}),
        ...(dto.followerRange !== undefined
          ? { followerRange: dto.followerRange }
          : {}),
      },
    });

    user = await this.ensureInstagramVerifyCode(user);
    return this.toPublic(user);
  }

  async updatePhoto(user: User, file: Express.Multer.File) {
    const relative = await this.uploads.saveImage('avatars', file);
    const photoUrl = this.uploads.toPublicUrl(relative);

    if (user.photoUrl) {
      await this.uploads.deleteByPublicUrl(user.photoUrl);
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { photoUrl },
    });
    return this.toPublic(updated);
  }

  async removePhoto(user: User) {
    if (user.photoUrl) {
      await this.uploads.deleteByPublicUrl(user.photoUrl);
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { photoUrl: null },
    });
    return this.toPublic(updated);
  }
}
