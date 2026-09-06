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
  AUDIENCE_PROOF_MAX_IMAGES,
  audienceProofSelect,
  mapAudienceProofs,
  type AudienceProofCard,
} from '../common/audience-proof';
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

  toPublic(user: User, audienceProofs: AudienceProofCard[] = []) {
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
      audienceProofs: mapAudienceProofs(audienceProofs),
      approvalStatus: user.approvalStatus,
      canAccessPanel: influencerCanAccessPanel(user),
      canSendOffers: influencerCanSendOffers(user),
      nextScreen: influencerNextScreen(user),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async listAudienceProofs(userId: string): Promise<AudienceProofCard[]> {
    return this.prisma.audienceProof.findMany({
      where: { userId },
      orderBy: { sortOrder: 'asc' },
      select: audienceProofSelect,
    });
  }

  async serialize(user: User) {
    const audienceProofs =
      user.role === UserRole.INFLUENCER
        ? await this.listAudienceProofs(user.id)
        : [];
    return this.toPublic(user, audienceProofs);
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.serialize(user);
  }

  toMarketplaceProfile(user: User, audienceProofs: AudienceProofCard[] = []) {
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
      audienceProofs:
        user.role === UserRole.INFLUENCER
          ? mapAudienceProofs(audienceProofs)
          : [],
    };
  }

  async getPublicProfile(viewer: User, id: string) {
    if (viewer.id === id) {
      const proofs =
        viewer.role === UserRole.INFLUENCER
          ? await this.listAudienceProofs(viewer.id)
          : [];
      return this.toMarketplaceProfile(viewer, proofs);
    }

    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.role === UserRole.ADMIN) {
      throw new NotFoundException('پروفایل پیدا نشد');
    }

    if (viewer.role === UserRole.ADMIN) {
      const proofs =
        target.role === UserRole.INFLUENCER
          ? await this.listAudienceProofs(target.id)
          : [];
      return this.toMarketplaceProfile(target, proofs);
    }

    const allowed = await this.canViewPublicProfile(viewer, target);
    if (!allowed) {
      throw new NotFoundException('پروفایل پیدا نشد');
    }

    const proofs =
      target.role === UserRole.INFLUENCER
        ? await this.listAudienceProofs(target.id)
        : [];
    return this.toMarketplaceProfile(target, proofs);
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
    return this.serialize(user);
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
    return this.serialize(updated);
  }

  async removePhoto(user: User) {
    if (user.photoUrl) {
      await this.uploads.deleteByPublicUrl(user.photoUrl);
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { photoUrl: null },
    });
    return this.serialize(updated);
  }

  async addAudienceProofs(user: User, files: Express.Multer.File[]) {
    if (user.role !== UserRole.INFLUENCER) {
      throw new BadRequestException('فقط بلاگرها می‌توانند مدارک مخاطب آپلود کنند');
    }
    if (!files?.length) {
      throw new BadRequestException('حداقل یک تصویر ارسال کنید');
    }

    const existing = await this.listAudienceProofs(user.id);
    const remaining = AUDIENCE_PROOF_MAX_IMAGES - existing.length;
    if (remaining <= 0) {
      throw new BadRequestException(
        `حداکثر ${AUDIENCE_PROOF_MAX_IMAGES} تصویر برای آنالیتیکس مجاز است`,
      );
    }

    const toSave = files.slice(0, remaining);
    let sortOrder =
      existing.reduce((max, img) => Math.max(max, img.sortOrder), -1) + 1;

    for (const file of toSave) {
      const relative = await this.uploads.saveImage('audience', file);
      const url = this.uploads.toPublicUrl(relative);
      await this.prisma.audienceProof.create({
        data: {
          userId: user.id,
          url,
          sortOrder: sortOrder++,
        },
      });
    }

    return this.serialize(user);
  }

  async removeAudienceProof(user: User, proofId: string) {
    if (user.role !== UserRole.INFLUENCER) {
      throw new BadRequestException('فقط بلاگرها می‌توانند مدارک مخاطب را حذف کنند');
    }

    const proof = await this.prisma.audienceProof.findFirst({
      where: { id: proofId, userId: user.id },
    });
    if (!proof) {
      throw new NotFoundException('تصویر پیدا نشد');
    }

    await this.uploads.deleteByPublicUrl(proof.url);
    await this.prisma.audienceProof.delete({ where: { id: proofId } });
    return this.serialize(user);
  }
}
