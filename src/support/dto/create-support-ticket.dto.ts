import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeIranPhone, toEnglishDigits } from '../../common/phone.util';

export class CreateSupportTicketDto {
  @ApiProperty({
    example: '09121234567',
    description: 'Contact mobile number (09…, +989…, or 9…)',
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? normalizeIranPhone(toEnglishDigits(value).replace(/[\s\-()]/g, ''))
      : value,
  )
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone!: string;

  @ApiProperty({ example: 'مشکل در پرداخت کیف پول', maxLength: 120 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3, { message: 'موضوع را وارد کنید' })
  @MaxLength(120, { message: 'موضوع حداکثر ۱۲۰ کاراکتر باشد' })
  subject!: string;

  @ApiProperty({
    example: 'پرداخت انجام شد اما موجودی کیف پول به‌روز نشد.',
    maxLength: 2000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(10, { message: 'پیام حداقل ۱۰ کاراکتر باشد' })
  @MaxLength(2000, { message: 'پیام حداکثر ۲۰۰۰ کاراکتر باشد' })
  message!: string;
}
