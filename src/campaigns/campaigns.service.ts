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
  type CampaignImage,
  type User,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CAMPAIGN_MAX_IMAGES,
  UploadsService,
} from '../uploads/uploads.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

type CampaignWithImages = Campaign & { images: CampaignImage[] };

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  toPublic(campaign: CampaignWithImages) {
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
      images: campaign.images
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((img) => ({
          id: img.id,
          url: img.url,
          sortOrder: img.sortOrder,
        })),
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
    if (min != null && max != null && min > max) {
      throw new BadRequestException('حداقل بودجه نمی‌تواند بیشتر از حداکثر باشد');
    }
  }

  private async getOwned(user: User, id: string) {
    this.assertBrand(user);
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!campaign || campaign.brandId !== user.id) {
      throw new NotFoundException('کمپین پیدا نشد');
    }
    return campaign;
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
      include: { images: true },
    });

    return this.toPublic(campaign);
  }

  async listMine(user: User) {
    this.assertBrand(user);

    const campaigns = await this.prisma.campaign.findMany({
      where: { brandId: user.id },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((c) => this.toPublic(c));
  }

  async getMine(user: User, id: string) {
    const campaign = await this.getOwned(user, id);
    return this.toPublic(campaign);
  }

  async update(user: User, id: string, dto: UpdateCampaignDto) {
    const existing = await this.getOwned(user, id);

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
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });

    return this.toPublic(campaign);
  }

  async addImages(user: User, id: string, files: Express.Multer.File[]) {
    const campaign = await this.getOwned(user, id);
    if (!files?.length) {
      throw new BadRequestException('حداقل یک تصویر ارسال کنید');
    }

    const remaining = CAMPAIGN_MAX_IMAGES - campaign.images.length;
    if (remaining <= 0) {
      throw new BadRequestException(
        `حداکثر ${CAMPAIGN_MAX_IMAGES} تصویر برای هر کمپین مجاز است`,
      );
    }

    const toSave = files.slice(0, remaining);
    let sortOrder =
      campaign.images.reduce((max, img) => Math.max(max, img.sortOrder), -1) +
      1;

    for (const file of toSave) {
      const relative = this.uploads.saveImage('campaigns', file);
      const url = this.uploads.toPublicUrl(relative);
      await this.prisma.campaignImage.create({
        data: {
          campaignId: id,
          url,
          sortOrder: sortOrder++,
        },
      });
    }

    return this.getMine(user, id);
  }

  async removeImage(user: User, campaignId: string, imageId: string) {
    const campaign = await this.getOwned(user, campaignId);
    const image = campaign.images.find((img) => img.id === imageId);
    if (!image) {
      throw new NotFoundException('تصویر پیدا نشد');
    }

    this.uploads.deleteByPublicUrl(image.url);
    await this.prisma.campaignImage.delete({ where: { id: imageId } });

    return this.getMine(user, campaignId);
  }
}
