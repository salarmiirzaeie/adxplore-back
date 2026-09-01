import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, type User } from '../generated/prisma/client';
import {
  normalizeCategories,
  parseCategories,
  primaryCategory,
} from '../common/categories';
import { resolveProfileLocation } from '../common/cities';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

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
      goal: user.goal,
      businessSize: user.businessSize,
      followerRange: user.followerRange,
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
      const nextName =
        dto.name !== undefined ? dto.name.trim() : existing.name;

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
      const nextName =
        dto.name !== undefined ? dto.name.trim() : existing.name;
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

    const user = await this.prisma.user.update({
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
              website:
                dto.website === null ? null : dto.website.trim() || null,
            }
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
    return this.toPublic(user);
  }

  async updatePhoto(user: User, file: Express.Multer.File) {
    const relative = this.uploads.saveImage('avatars', file);
    const photoUrl = this.uploads.toPublicUrl(relative);

    if (user.photoUrl) {
      this.uploads.deleteByPublicUrl(user.photoUrl);
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { photoUrl },
    });
    return this.toPublic(updated);
  }

  async removePhoto(user: User) {
    if (user.photoUrl) {
      this.uploads.deleteByPublicUrl(user.photoUrl);
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { photoUrl: null },
    });
    return this.toPublic(updated);
  }
}
