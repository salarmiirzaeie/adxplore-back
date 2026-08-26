import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  InvitationStatus,
  UserRole,
  type Campaign,
  type CampaignImage,
  type Prisma,
  type User,
} from '../generated/prisma/client';
import {
  normalizeCategories,
  parseCategories,
  primaryCategory,
} from '../common/categories';
import { PrismaService } from '../prisma/prisma.service';
import {
  CAMPAIGN_MAX_IMAGES,
  UploadsService,
} from '../uploads/uploads.service';
import { BrowseCampaignsQueryDto } from './dto/browse-campaigns-query.dto';
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
    const categories = parseCategories(campaign.categories, campaign.category);
    return {
      id: campaign.id,
      brandId: campaign.brandId,
      title: campaign.title,
      brief: campaign.brief,
      category: primaryCategory(categories) ?? campaign.category,
      categories,
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

  private resolveCategories(dto: {
    categories?: CreateCampaignDto['categories'];
    category?: CreateCampaignDto['category'];
  }) {
    const list =
      dto.categories !== undefined
        ? normalizeCategories(dto.categories)
        : dto.category
          ? normalizeCategories([dto.category])
          : [];
    const primary = primaryCategory(list);
    if (!primary) {
      throw new BadRequestException('حداقل یک دسته انتخاب کنید');
    }
    return { categories: list, category: primary };
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
    const { categories, category } = this.resolveCategories(dto);

    const status = dto.status ?? CampaignStatus.DRAFT;
    if (status === CampaignStatus.CLOSED) {
      throw new BadRequestException('نمی‌توان کمپین را در وضعیت بسته ایجاد کرد');
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        brandId: user.id,
        title: dto.title.trim(),
        brief: dto.brief.trim(),
        category,
        categories,
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

  async browseOpen(user: User, query: BrowseCampaignsQueryDto) {
    if (user.role !== UserRole.INFLUENCER) {
      throw new ForbiddenException('فقط اینفلوئنسرها می‌توانند کمپین‌ها را مرور کنند');
    }

    const where: Prisma.CampaignWhereInput = {
      status: CampaignStatus.OPEN,
    };

    if (query.category) {
      where.category = query.category;
    }

    if (query.city?.trim()) {
      where.city = { contains: query.city.trim() };
    }

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [{ title: { contains: q } }, { brief: { contains: q } }];
    }

    if (query.invited) {
      where.invitations = {
        some: {
          influencerId: user.id,
          status: InvitationStatus.PENDING,
        },
      };
    }

    if (query.forMe) {
      // City match from profile when no explicit city filter was set
      if (user.city?.trim() && !query.city?.trim()) {
        where.city = { contains: user.city.trim() };
      }
    }

    const campaigns = await this.prisma.campaign.findMany({
      where,
      include: { images: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (!query.forMe) {
      return campaigns.map((c) => this.toPublic(c));
    }

    const myCategories = new Set(
      parseCategories(user.categories, user.category),
    );
    if (!myCategories.size) {
      return campaigns.map((c) => this.toPublic(c));
    }

    return campaigns
      .filter((c) => {
        const campaignCategories = parseCategories(c.categories, c.category);
        return campaignCategories.some((cat) => myCategories.has(cat));
      })
      .map((c) => this.toPublic(c));
  }

  async getOne(user: User, id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!campaign) {
      throw new NotFoundException('کمپین پیدا نشد');
    }

    if (user.role === UserRole.BRAND) {
      if (campaign.brandId !== user.id) {
        throw new NotFoundException('کمپین پیدا نشد');
      }
      return this.toPublic(campaign);
    }

    if (user.role === UserRole.INFLUENCER) {
      if (campaign.status !== CampaignStatus.OPEN) {
        throw new NotFoundException('کمپین پیدا نشد');
      }
      return this.toPublic(campaign);
    }

    throw new ForbiddenException('دسترسی مجاز نیست');
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
