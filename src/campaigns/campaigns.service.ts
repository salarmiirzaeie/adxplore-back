import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  UserRole,
  type Campaign,
  type User,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  toPublic(campaign: Campaign) {
    return {
      id: campaign.id,
      brandId: campaign.brandId,
      title: campaign.title,
      brief: campaign.brief,
      category: campaign.category,
      city: campaign.city,
      deliverable: campaign.deliverable,
      budgetMin: campaign.budgetMin,
      budgetMax: campaign.budgetMax,
      status: campaign.status,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  private assertBrand(user: User) {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException('فقط برندها می‌توانند کمپین مدیریت کنند');
    }
  }

  private assertBudget(min?: number | null, max?: number | null) {
    if (
      min != null &&
      max != null &&
      min > max
    ) {
      throw new BadRequestException('حداقل بودجه نمی‌تواند بیشتر از حداکثر باشد');
    }
  }

  async create(user: User, dto: CreateCampaignDto) {
    this.assertBrand(user);
    this.assertBudget(dto.budgetMin, dto.budgetMax);

    const status = dto.status ?? CampaignStatus.DRAFT;
    if (status === CampaignStatus.CLOSED) {
      throw new BadRequestException('نمی‌توان کمپین را در وضعیت بسته ایجاد کرد');
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        brandId: user.id,
        title: dto.title.trim(),
        brief: dto.brief.trim(),
        category: dto.category,
        city: dto.city.trim(),
        deliverable: dto.deliverable,
        budgetMin: dto.budgetMin ?? null,
        budgetMax: dto.budgetMax ?? null,
        status,
      },
    });

    return this.toPublic(campaign);
  }

  async listMine(user: User) {
    this.assertBrand(user);

    const campaigns = await this.prisma.campaign.findMany({
      where: { brandId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((c) => this.toPublic(c));
  }

  async getMine(user: User, id: string) {
    this.assertBrand(user);

    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign || campaign.brandId !== user.id) {
      throw new NotFoundException('کمپین پیدا نشد');
    }

    return this.toPublic(campaign);
  }

  async update(user: User, id: string, dto: UpdateCampaignDto) {
    this.assertBrand(user);

    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing || existing.brandId !== user.id) {
      throw new NotFoundException('کمپین پیدا نشد');
    }

    const nextMin =
      dto.budgetMin !== undefined ? dto.budgetMin : existing.budgetMin;
    const nextMax =
      dto.budgetMax !== undefined ? dto.budgetMax : existing.budgetMax;
    this.assertBudget(nextMin, nextMax);

    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.brief !== undefined ? { brief: dto.brief.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.deliverable !== undefined
          ? { deliverable: dto.deliverable }
          : {}),
        ...(dto.budgetMin !== undefined ? { budgetMin: dto.budgetMin } : {}),
        ...(dto.budgetMax !== undefined ? { budgetMax: dto.budgetMax } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    return this.toPublic(campaign);
  }
}
