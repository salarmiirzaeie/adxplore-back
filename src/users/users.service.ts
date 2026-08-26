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

    if (existing.role === UserRole.BRAND) {
      const nextName =
        dto.name !== undefined ? dto.name.trim() : existing.name;
      const nextCity =
        dto.city !== undefined ? dto.city.trim() : existing.city;

      if (!nextName?.trim() || !nextPrimary || !nextCity?.trim()) {
        throw new BadRequestException(
          'پروفایل برند باید شامل نام، دسته و شهر باشد',
        );
      }
    }

    if (existing.role === UserRole.INFLUENCER) {
      const nextName =
        dto.name !== undefined ? dto.name.trim() : existing.name;
      const nextCity =
        dto.city !== undefined ? dto.city.trim() : existing.city;
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
        !nextWebsite?.trim() ||
        !nextFollowerRange
      ) {
        throw new BadRequestException(
          'پروفایل اینفلوئنسر باید شامل نام، اینستاگرام، دسته، شهر و بازه فالوور باشد',
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
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
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
