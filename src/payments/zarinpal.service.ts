import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ZarinpalRequestResult = {
  code: number;
  authority: string;
  fee?: number;
  message?: string;
};

export type ZarinpalVerifyResult = {
  code: number;
  refId: string;
  cardPan?: string;
  fee?: number;
  message?: string;
};

@Injectable()
export class ZarinpalService {
  private readonly logger = new Logger(ZarinpalService.name);

  constructor(private readonly config: ConfigService) {}

  isSandbox() {
    const flag = this.config.get<string>('ZARINPAL_SANDBOX', 'true');
    return flag !== 'false' && flag !== '0';
  }

  merchantId() {
    return (
      this.config.get<string>('ZARINPAL_MERCHANT_ID')?.trim() ||
      '00000000-0000-0000-0000-000000000000'
    );
  }

  private apiBase() {
    return this.isSandbox()
      ? 'https://sandbox.zarinpal.com/pg/v4/payment'
      : 'https://api.zarinpal.com/pg/v4/payment';
  }

  startPayUrl(authority: string) {
    const host = this.isSandbox()
      ? 'https://sandbox.zarinpal.com/pg/StartPay/'
      : 'https://www.zarinpal.com/pg/StartPay/';
    return `${host}${encodeURIComponent(authority)}`;
  }

  callbackUrl() {
    const explicit = this.config.get<string>('ZARINPAL_CALLBACK_URL')?.trim();
    if (explicit) return explicit;
    const port = this.config.get<string>('PORT', '3000');
    return `http://localhost:${port}/v1/payments/callback`;
  }

  frontendResultUrl(params: Record<string, string>) {
    const base =
      this.config.get<string>('FRONTEND_URL')?.trim() ||
      'http://localhost:5173';
    const q = new URLSearchParams(params).toString();
    return `${base.replace(/\/$/, '')}/app/payments/result?${q}`;
  }

  /** Deal fee is stored in toman; ZarinPal IRR expects rials. */
  tomanToRial(amountToman: number) {
    return Math.max(0, Math.round(amountToman)) * 10;
  }

  async requestPayment(params: {
    amountRial: number;
    description: string;
    mobile?: string | null;
    email?: string | null;
    metadata?: Record<string, string>;
  }): Promise<ZarinpalRequestResult> {
    const payload: Record<string, unknown> = {
      merchant_id: this.merchantId(),
      amount: params.amountRial,
      callback_url: this.callbackUrl(),
      description: params.description.slice(0, 255),
      currency: 'IRR',
    };
    if (params.mobile) payload.mobile = params.mobile;
    if (params.email) payload.email = params.email;
    if (params.metadata) payload.metadata = params.metadata;

    const json = await this.postJson(`${this.apiBase()}/request.json`, payload);
    const code = Number(json?.data?.code ?? json?.errors?.code ?? 0);
    const authority = String(json?.data?.authority ?? '');
    const message =
      (json?.data?.message as string | undefined) ||
      (json?.errors?.message as string | undefined);

    if (code !== 100 || !authority) {
      this.logger.warn(`ZarinPal request failed code=${code} msg=${message}`);
    }

    return {
      code,
      authority,
      fee: json?.data?.fee != null ? Number(json.data.fee) : undefined,
      message,
    };
  }

  async verifyPayment(params: {
    amountRial: number;
    authority: string;
  }): Promise<ZarinpalVerifyResult> {
    const json = await this.postJson(`${this.apiBase()}/verify.json`, {
      merchant_id: this.merchantId(),
      amount: params.amountRial,
      authority: params.authority,
    });

    const code = Number(json?.data?.code ?? json?.errors?.code ?? 0);
    const refId =
      json?.data?.ref_id != null ? String(json.data.ref_id) : '';
    const message =
      (json?.data?.message as string | undefined) ||
      (json?.errors?.message as string | undefined);

    return {
      code,
      refId,
      cardPan: json?.data?.card_pan ? String(json.data.card_pan) : undefined,
      fee: json?.data?.fee != null ? Number(json.data.fee) : undefined,
      message,
    };
  }

  private async postJson(
    url: string,
    payload: Record<string, unknown>,
  ): Promise<any> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        this.logger.error(`Invalid ZarinPal JSON from ${url}: ${text.slice(0, 200)}`);
        return { errors: { message: 'پاسخ نامعتبر از زرین‌پال' } };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'network error';
      this.logger.error(`ZarinPal network error: ${msg}`);
      return { errors: { message: msg } };
    }
  }
}
