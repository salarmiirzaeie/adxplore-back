import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeCardNumber, normalizeSheba } from '../../common/iran-bank-card';

export class UpsertBankCardDto {
  @ApiProperty({ example: 'سارا محمدی', maxLength: 80 })
  @IsString()
  @MinLength(2, { message: 'نام صاحب کارت را وارد کنید' })
  @MaxLength(80)
  holderName!: string;

  @ApiProperty({
    example: '6037998181818187',
    description: '۱۶ رقم شماره کارت شتاب',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeCardNumber(value) : value,
  )
  @IsString()
  @Matches(/^\d{16}$/, { message: 'شماره کارت باید ۱۶ رقم باشد' })
  cardNumber!: string;

  @ApiProperty({
    example: 'IR760170000000000000000001',
    description: 'شماره شبا (با یا بدون IR)',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeSheba(value) : value,
  )
  @IsString()
  @Matches(/^IR\d{24}$/i, { message: 'شماره شبا باید IR و ۲۴ رقم باشد' })
  sheba!: string;
}
