import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(UploadsService.name);
  readonly rootDir: string;
  private readonly s3?: S3Client;
  private readonly bucket?: string;
  private readonly s3PublicBase?: string;

  constructor(private readonly config: ConfigService) {
    this.rootDir = join(process.cwd(), 'uploads');

    const endpoint = this.config.get<string>('S3_ENDPOINT')?.replace(/\/$/, '');
    const accessKey = this.config.get<string>('S3_ACCESS_KEY');
    const secretKey = this.config.get<string>('S3_SECRET_KEY');
    const bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const configured = [endpoint, accessKey, secretKey, bucket].filter(Boolean);

    if (configured.length > 0 && configured.length < 4) {
      throw new Error(
        'Incomplete S3 config: set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_BUCKET',
      );
    }

    if (endpoint && accessKey && secretKey && bucket) {
      this.s3 = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        forcePathStyle: true,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
      this.bucket = bucket;
      this.s3PublicBase = (
        this.config.get<string>('S3_PUBLIC_URL') || `${endpoint}/${bucket}`
      ).replace(/\/$/, '');
      this.logger.log(`Uploads: S3 bucket ${bucket} at ${endpoint}`);
      return;
    }

    if (!existsSync(this.rootDir)) {
      mkdirSync(this.rootDir, { recursive: true });
    }
    for (const sub of ['avatars', 'campaigns', 'deals', 'chat'] as const) {
      const dir = join(this.rootDir, sub);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
    this.logger.log('Uploads: local disk (set S3_* env vars to use object storage)');
  }

  private localPublicBase(): string {
    return (
      this.config.get<string>('PUBLIC_BASE_URL') ||
      `http://localhost:${this.config.get<number>('PORT', 3000)}`
    ).replace(/\/$/, '');
  }

  toPublicUrl(relativePath: string): string {
    const clean = relativePath.replace(/^\/+/, '');
    if (this.s3PublicBase) {
      return `${this.s3PublicBase}/${clean}`;
    }
    return `${this.localPublicBase()}/uploads/${clean}`;
  }

  relativeFromPublicUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (this.s3PublicBase && url.startsWith(`${this.s3PublicBase}/`)) {
      return url.slice(this.s3PublicBase.length + 1);
    }
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

  async saveImage(folder: UploadFolder, file: Express.Multer.File): Promise<string> {
    this.assertImageFile(file);
    return this.writeFile(folder, file);
  }

  async saveMedia(
    folder: UploadFolder,
    file: Express.Multer.File,
  ): Promise<{ relative: string; kind: MediaKind }> {
    const kind = this.assertMediaFile(file);
    return { relative: await this.writeFile(folder, file), kind };
  }

  private async writeFile(
    folder: UploadFolder,
    file: Express.Multer.File,
  ): Promise<string> {
    const relative = `${folder}/${randomUUID()}${this.extForMime(file.mimetype)}`;
    if (this.s3 && this.bucket) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: relative,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return relative;
    }
    writeFileSync(join(this.rootDir, relative), file.buffer);
    return relative;
  }

  async deleteRelative(relative: string | null | undefined) {
    if (!relative) return;
    if (this.s3 && this.bucket) {
      try {
        await this.s3.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: relative,
          }),
        );
      } catch {
        /* ignore */
      }
      return;
    }
    const absolute = join(this.rootDir, relative);
    try {
      if (existsSync(absolute)) unlinkSync(absolute);
    } catch {
      /* ignore */
    }
  }

  async deleteByPublicUrl(url: string | null | undefined) {
    await this.deleteRelative(this.relativeFromPublicUrl(url));
  }
}
