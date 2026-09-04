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
  mapPartyCategories,
  normalizeCategories,
  parseCategories,
  primaryCategory,
} from '../common/categories';
import {
  campaignLocationWhere,
  resolveCampaignLocation,
} from '../common/cities';
import {
  normalizeDeliverables,
  parseDeliverables,
  primaryDeliverable,
} from '../common/deliverables';
import { campaignBrandSelect } from '../common/party-select';
import { PrismaService } from '../prisma/prisma.service';
import {
  CAMPAIGN_MAX_IMAGES,
  UploadsService,
} from '../media/uploads.service';
import { resolveBrandStatus } from '../common/campaign-status';
import { BrowseCampaignsQueryDto } from './dto/browse-campaigns-query.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

const campaignPublicInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  brand: { select: campaignBrandSelect },
};

type CampaignBrand = {
  id: string;
  name: string | null;
  photoUrl: string | null;
  website: string | null;
  bio: string | null;
  category: import('../generated/prisma/client').BrandCategory | null;
  categories: unknown;
  city: string | null;
  province: string | null;
  goal: import('../generated/prisma/client').BrandGoal | null;
  businessSize: import('../generated/prisma/client').BusinessSize | null;
};

type CampaignWithImages = Campaign & {
  images: CampaignImage[];
  brand: CampaignBrand;
};

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  toPublic(campaign: CampaignWithImages) {
    const categories = parseCategories(campaign.categories, campaign.category);
    const deliverables = parseDeliverables(
      campaign.deliverables,
      campaign.deliverable,
    );
    return {
      id: campaign.id,
      brandId: campaign.brandId,
      title: campaign.title,
      brief: campaign.brief,
      category: primaryCategory(categories) ?? campaign.category,
      categories,
      city: campaign.city,
      province: campaign.province,
      deliverable: primaryDeliverable(deliverables) ?? campaign.deliverable,
      deliverables,
      budgetMin: campaign.budgetMin,
      budgetMax: campaign.budgetMax,
      status: campaign.status,
      rejectionReason: campaign.rejectionReason,
      rejectedAt: campaign.rejectedAt,
      images: campaign.images
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((img) => ({
          id: img.id,
          url: img.url,
          sortOrder: img.sortOrder,
        })),
      brand: mapPartyCategories(campaign.brand),
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
      throw new BadRequestException(
        'حداقل بودجه نمی‌تواند بیشتر از حداکثر باشد',
      );
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

  private resolveDeliverables(dto: {
    deliverables?: CreateCampaignDto['deliverables'];
    deliverable?: CreateCampaignDto['deliverable'];
  }) {
    const list =
      dto.deliverables !== undefined
        ? normalizeDeliverables(dto.deliverables)
        : dto.deliverable
          ? normalizeDeliverables([dto.deliverable])
          : [];
    const primary = primaryDeliverable(list);
    if (!primary) {
      throw new BadRequestException('حداقل یک نوع محتوا انتخاب کنید');
    }
    return { deliverables: list, deliverable: primary };
  }

  private async getOwned(user: User, id: string) {
    this.assertBrand(user);
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: campaignPublicInclude,
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
    const { deliverables, deliverable } = this.resolveDeliverables(dto);

    const status = resolveBrandStatus(dto.status);
    if (status === CampaignStatus.CLOSED) {
      throw new BadRequestException(
        'نمی‌توان کمپین را در وضعیت بسته ایجاد کرد',
      );
    }

    const location = resolveCampaignLocation(dto.city, dto.province);

    const campaign = await this.prisma.campaign.create({
      data: {
        brandId: user.id,
        title: dto.title.trim(),
        brief: dto.brief.trim(),
        category,
        categories,
        city: location.city,
        province: location.province,
        deliverable,
        deliverables,
        budgetMin: dto.budgetMin ?? null,
        budgetMax: dto.budgetMax ?? null,
        status,
      },
      include: campaignPublicInclude,
    });

    return this.toPublic(campaign);
  }

  async listMine(user: User) {
    this.assertBrand(user);

    const campaigns = await this.prisma.campaign.findMany({
      where: { brandId: user.id },
      include: campaignPublicInclude,
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((c) => this.toPublic(c));
  }

  async browseOpen(user: User, query: BrowseCampaignsQueryDto) {
    if (user.role !== UserRole.INFLUENCER) {
      throw new ForbiddenException(
        'فقط اینفلوئنسرها می‌توانند کمپین‌ها را مرور کنند',
      );
    }

    const where: Prisma.CampaignWhereInput = {
      status: CampaignStatus.OPEN,
    };
    const and: Prisma.CampaignWhereInput[] = [];

    if (query.category) {
      where.category = query.category;
    }

    const cityWhere =
      query.city?.trim() || query.province?.trim()
        ? campaignLocationWhere({
            city: query.city,
            province: query.province,
          })
        : query.forMe
          ? campaignLocationWhere({
              city: user.city,
              province: user.province,
            })
          : undefined;
    if (cityWhere) {
      and.push(cityWhere);
    }

    if (query.q?.trim()) {
      const q = query.q.trim();
      and.push({
        OR: [{ title: { contains: q } }, { brief: { contains: q } }],
      });
    }

    if (query.invited) {
      where.invitations = {
        some: {
          influencerId: user.id,
          status: InvitationStatus.PENDING,
        },
      };
    }

    if (and.length) {
      where.AND = and;
    }

    const campaigns = await this.prisma.campaign.findMany({
      where,
      include: campaignPublicInclude,
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
      include: campaignPublicInclude,
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

    const categoryUpdate =
      dto.categories !== undefined || dto.category !== undefined
        ? this.resolveCategories({
            categories:
              dto.categories ??
              parseCategories(existing.categories, existing.category),
            category: dto.category,
          })
        : null;

    const deliverableUpdate =
      dto.deliverables !== undefined || dto.deliverable !== undefined
        ? this.resolveDeliverables({
            deliverables:
              dto.deliverables ??
              parseDeliverables(existing.deliverables, existing.deliverable),
            deliverable: dto.deliverable,
          })
        : null;

    const locationUpdate =
      dto.city !== undefined || dto.province !== undefined
        ? resolveCampaignLocation(
            dto.city !== undefined ? dto.city : existing.city,
            dto.province !== undefined ? dto.province : existing.province,
          )
        : null;

    const nextStatus =
      dto.status !== undefined
        ? resolveBrandStatus(dto.status, existing.status)
        : undefined;
    const submittingForReview =
      nextStatus === CampaignStatus.PENDING_REVIEW &&
      existing.status !== CampaignStatus.PENDING_REVIEW;

    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.brief !== undefined ? { brief: dto.brief.trim() } : {}),
        ...(categoryUpdate
          ? {
              category: categoryUpdate.category,
              categories: categoryUpdate.categories,
            }
          : {}),
        ...(locationUpdate
          ? { city: locationUpdate.city, province: locationUpdate.province }
          : {}),
        ...(deliverableUpdate
          ? {
              deliverable: deliverableUpdate.deliverable,
              deliverables: deliverableUpdate.deliverables,
            }
          : {}),
        ...(dto.budgetMin !== undefined ? { budgetMin: dto.budgetMin } : {}),
        ...(dto.budgetMax !== undefined ? { budgetMax: dto.budgetMax } : {}),
        ...(nextStatus !== undefined ? { status: nextStatus } : {}),
        ...(submittingForReview
          ? { rejectionReason: null, rejectedAt: null }
          : {}),
      },
      include: campaignPublicInclude,
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
