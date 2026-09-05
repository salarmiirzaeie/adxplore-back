import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

const STALE_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  type: string;
  notificationId: string;
};

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly app: App | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.app = this.initApp();
  }

  isConfigured() {
    return this.app !== null;
  }

  async notifyUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.app) return;

    const rows = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (rows.length === 0) return;

    const frontend = this.config
      .get<string>('FRONTEND_URL', 'https://app.adxplore.ir')
      .replace(/\/$/, '');
    const path = payload.url.startsWith('/') ? payload.url : `/${payload.url}`;
    const link = `${frontend}${path}`;
    const data = {
      title: payload.title,
      body: payload.body,
      url: path,
      type: payload.type,
      notificationId: payload.notificationId,
    };

    try {
      const result = await getMessaging(this.app).sendEachForMulticast({
        tokens: rows.map((r) => r.token),
        notification: { title: payload.title, body: payload.body },
        data,
        webpush: {
          fcmOptions: { link },
          notification: {
            icon: `${frontend}/icons/icon-192.png`,
            badge: `${frontend}/icons/icon-192.png`,
          },
        },
      });

      const stale: string[] = [];
      for (let i = 0; i < result.responses.length; i++) {
        const res = result.responses[i];
        if (!res || res.success) continue;
        const code = res.error?.code ?? '';
        const token = rows[i]?.token;
        this.logger.warn(`FCM send failed (${code}): ${res.error?.message}`);
        if (token && STALE_TOKEN_CODES.has(code)) stale.push(token);
      }
      if (stale.length > 0) {
        await this.prisma.pushToken.deleteMany({
          where: { token: { in: stale } },
        });
      }
    } catch (err) {
      this.logger.error('FCM multicast failed', err);
    }
  }

  private initApp(): App | null {
    if (getApps().length > 0) return getApps()[0] ?? null;

    const json = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (json?.trim()) {
      try {
        const parsed = JSON.parse(json) as ServiceAccount;
        return initializeApp({ credential: cert(parsed) });
      } catch (err) {
        this.logger.error(
          'FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON',
          err,
        );
        return null;
      }
    }

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const rawKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');
    if (projectId && clientEmail && rawKey) {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: rawKey.replace(/\\n/g, '\n'),
        }),
      });
    }

    const fromFile = this.loadServiceAccountFromFile();
    if (fromFile) {
      return initializeApp({ credential: cert(fromFile) });
    }

    this.logger.warn(
      'Firebase Admin is not configured — push notifications will not be sent',
    );
    return null;
  }

  private loadServiceAccountFromFile(): ServiceAccount | null {
    const filePath =
      this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH') ||
      this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
    if (!filePath?.trim()) return null;

    const resolved = isAbsolute(filePath)
      ? filePath
      : resolve(process.cwd(), filePath);
    if (!existsSync(resolved)) {
      this.logger.error(`Firebase service account file not found: ${resolved}`);
      return null;
    }

    try {
      return JSON.parse(readFileSync(resolved, 'utf8')) as ServiceAccount;
    } catch (err) {
      this.logger.error(
        `Failed to read Firebase service account file ${resolved}`,
        err,
      );
      return null;
    }
  }
}
