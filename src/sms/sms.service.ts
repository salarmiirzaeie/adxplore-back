import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { smsOtpCode } from './melipayamak';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const path = this.config.get<string>('SMS_MELIPAYAMAK_PATH');
    if (!path) {
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(
          `SMS_MELIPAYAMAK_PATH unset — OTP for ${phone}: ${code}`,
        );
        return;
      }
      throw new ServiceUnavailableException('SMS provider is not configured');
    }

    try {
      await smsOtpCode(phone, code);
    } catch (err) {
      this.logger.error(`Failed to send OTP SMS to ${phone}`, err);
      throw new ServiceUnavailableException('Failed to send SMS');
    }
  }
}
