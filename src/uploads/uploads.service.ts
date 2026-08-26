import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export const CAMPAIGN_MAX_IMAGES = 8;

@Injectable()
export class UploadsService {
  readonly rootDir: string;

  constructor(private readonly config: ConfigService) {
    this.rootDir = join(process.cwd(), 'uploads');
    if (!existsSync(this.rootDir)) {
      mkdirSync(this.rootDir, { recursive: true });
    }
    for (const sub of ['avatars', 'campaigns', 'deals'] as const) {
      const dir = join(this.rootDir, sub);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
  }

  private publicBase(): string {
    return (
      this.config.get<string>('PUBLIC_BASE_URL') ||
      `http://localhost:${this.config.get<number>('PORT', 3000)}`
    ).replace(/\/$/, '');
  }

  toPublicUrl(relativePath: string): string {
    const clean = relativePath.replace(/^\/+/, '');
    return `${this.publicBase()}/uploads/${clean}`;
  }

  relativeFromPublicUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const marker = '/uploads/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  }

  assertImageFile(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('فایل تصویر الزامی است');
    }
    if (!UPLOAD_MIME.has(file.mimetype)) {
      throw new BadRequestException('فقط JPEG، PNG یا WebP مجاز است');
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      throw new BadRequestException('حجم تصویر حداکثر ۵ مگابایت باشد');
    }
  }

  saveImage(
    folder: 'avatars' | 'campaigns' | 'deals',
    file: Express.Multer.File,
  ): string {
    this.assertImageFile(file);
    const ext =
      file.mimetype === 'image/png'
        ? '.png'
        : file.mimetype === 'image/webp'
          ? '.webp'
          : '.jpg';
    const relative = `${folder}/${randomUUID()}${ext}`;
    writeFileSync(join(this.rootDir, relative), file.buffer);
    return relative;
  }

  deleteRelative(relative: string | null | undefined) {
    if (!relative) return;
    const absolute = join(this.rootDir, relative);
    try {
      if (existsSync(absolute)) unlinkSync(absolute);
    } catch {
      /* ignore */
    }
  }

  deleteByPublicUrl(url: string | null | undefined) {
    this.deleteRelative(this.relativeFromPublicUrl(url));
  }
}
