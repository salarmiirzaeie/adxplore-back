import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { generateOtpCode, normalizeIranPhone } from '../common/phone.util';
import {
  parseCategories,
  primaryCategory,
} from '../common/categories';
import { JwtPayload } from './jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async requestOtp(rawPhone: string) {
    const phone = normalizeIranPhone(rawPhone);
    const ttl = this.config.get<number>('OTP_TTL_SECONDS', 300);
    const cooldown = this.config.get<number>(
      'OTP_RESEND_COOLDOWN_SECONDS',
      60,
    );
    const length = this.config.get<number>('OTP_LENGTH', 5);

    const latest = await this.prisma.otp.findFirst({
      where: { phone, consumed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (latest) {
      const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
      if (elapsed < cooldown) {
        throw new HttpException(
          `Please wait ${Math.ceil(cooldown - elapsed)}s before requesting another code`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    await this.prisma.otp.updateMany({
      where: { phone, consumed: false },
      data: { consumed: true },
    });

    const code = generateOtpCode(length);
    const expiresAt = new Date(Date.now() + ttl * 1000);

    await this.prisma.otp.create({
      data: { phone, code, expiresAt },
    });

    await this.sms.sendOtp(phone, code);

    return {
      ok: true,
      message: 'OTP sent',
      expiresIn: ttl,
    };
  }

  async verifyOtp(rawPhone: string, code: string, role: UserRole) {
    const phone = normalizeIranPhone(rawPhone);

    const otp = await this.prisma.otp.findFirst({
      where: {
        phone,
        code,
        consumed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { consumed: true },
    });

    let user = await this.prisma.user.findUnique({ where: { phone } });
    const isNewUser = !user;

    if (!user) {
      user = await this.prisma.user.create({
        data: { phone, role },
      });
    } else if (user.role !== role) {
      throw new ForbiddenException(
        user.role === UserRole.BRAND
          ? 'این شماره با نقش برند ثبت شده است. لطفاً به‌عنوان برند وارد شوید.'
          : 'این شماره با نقش اینفلوئنسر ثبت شده است. لطفاً به‌عنوان اینفلوئنسر وارد شوید.',
      );
    }

    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { userId: user.id },
    });

    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '7d'),
      isNewUser,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        category:
          primaryCategory(
            parseCategories(user.categories, user.category),
          ) ?? user.category,
        categories: parseCategories(user.categories, user.category),
        city: user.city,
        website: user.website,
        goal: user.goal,
        businessSize: user.businessSize,
        followerRange: user.followerRange,
        photoUrl: user.photoUrl,
      },
    };
  }
}
