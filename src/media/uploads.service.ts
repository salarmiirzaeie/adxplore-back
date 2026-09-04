import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

export const UPLOAD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
/** Multer ceiling for mixed image/video endpoints */
export const UPLOAD_MEDIA_MAX_BYTES = UPLOAD_VIDEO_MAX_BYTES;
/** @deprecated Use UPLOAD_IMAGE_MAX_BYTES */
export const UPLOAD_MAX_BYTES = UPLOAD_IMAGE_MAX_BYTES;

export const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);
export const UPLOAD_MIME = IMAGE_MIME;
export const CAMPAIGN_MAX_IMAGES = 8;

export type UploadFolder = 'avatars' | 'campaigns' | 'deals' | 'chat';
export type MediaKind = 'IMAGE' | 'VIDEO';

@Injectable()
export class UploadsService {
  readonly rootDir: string;

  constructor(private readonly config: ConfigService) {
    this.rootDir = join(process.cwd(), 'uploads');
    if (!existsSync(this.rootDir)) {
      mkdirSync(this.rootDir, { recursive: true });
    }
    for (const sub of ['avatars', 'campaigns', 'deals', 'chat'] as const) {
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
    if (!IMAGE_MIME.has(file.mimetype)) {
      throw new BadRequestException('فقط JPEG، PNG یا WebP مجاز است');
    }
    if (file.size > UPLOAD_IMAGE_MAX_BYTES) {
      throw new BadRequestException('حجم تصویر حداکثر ۵ مگابایت باشد');
    }
  }

  assertMediaFile(file?: Express.Multer.File): MediaKind {
    if (!file) {
      throw new BadRequestException('فایل الزامی است');
    }
    if (IMAGE_MIME.has(file.mimetype)) {
      if (file.size > UPLOAD_IMAGE_MAX_BYTES) {
        throw new BadRequestException('حجم تصویر حداکثر ۵ مگابایت باشد');
      }
      return 'IMAGE';
    }
    if (VIDEO_MIME.has(file.mimetype)) {
      if (file.size > UPLOAD_VIDEO_MAX_BYTES) {
        throw new BadRequestException('حجم ویدیو حداکثر ۵۰ مگابایت باشد');
      }
      return 'VIDEO';
    }
    throw new BadRequestException(
      'فقط تصویر (JPEG، PNG، WebP) یا ویدیو (MP4، WebM، MOV) مجاز است',
    );
  }

  private extForMime(mimetype: string): string {
    if (mimetype === 'image/png') return '.png';
    if (mimetype === 'image/webp') return '.webp';
    if (mimetype === 'video/webm') return '.webm';
    if (mimetype === 'video/quicktime') return '.mov';
    if (mimetype === 'video/mp4') return '.mp4';
    return '.jpg';
  }

  saveImage(folder: UploadFolder, file: Express.Multer.File): string {
    this.assertImageFile(file);
    return this.writeFile(folder, file);
  }

  saveMedia(
    folder: UploadFolder,
    file: Express.Multer.File,
  ): { relative: string; kind: MediaKind } {
    const kind = this.assertMediaFile(file);
    return { relative: this.writeFile(folder, file), kind };
  }

  private writeFile(folder: UploadFolder, file: Express.Multer.File): string {
    const relative = `${folder}/${randomUUID()}${this.extForMime(file.mimetype)}`;
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
