import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WalletTxType } from '../../generated/prisma/client';

export class BankCardResponse {
  @ApiProperty({ example: 'سارا محمدی' })
  holderName!: string;

  @ApiProperty({ example: '6037998181818187' })
  cardNumber!: string;

  @ApiProperty({ example: '603799******8187' })
  cardMasked!: string;

  @ApiProperty({ example: '8187' })
  cardLast4!: string;

  @ApiProperty({ example: 'IR760170000000000000000001' })
  sheba!: string;

  @ApiProperty({ example: 'بانک ملی ایران' })
  bankName!: string;

  @ApiPropertyOptional()
  updatedAt?: Date;
}

export class BankCardEnvelopeResponse {
  @ApiPropertyOptional({ type: BankCardResponse, nullable: true })
  bankCard!: BankCardResponse | null;
}

export class WalletResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  availableToman!: number;

  @ApiProperty()
  heldToman!: number;

  @ApiProperty()
  totalToman!: number;

  @ApiProperty()
  hasBankCard!: boolean;

  @ApiPropertyOptional({ type: BankCardResponse, nullable: true })
  bankCard!: BankCardResponse | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class WalletTransactionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  walletId!: string;

  @ApiProperty({ enum: WalletTxType })
  type!: WalletTxType;

  @ApiProperty()
  amountToman!: number;

  @ApiProperty()
  availableAfter!: number;

  @ApiProperty()
  heldAfter!: number;

  @ApiPropertyOptional({ nullable: true })
  dealId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  paymentId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ type: BankCardResponse, nullable: true })
  bankCard!: BankCardResponse | null;

  @ApiProperty()
  createdAt!: Date;
}

export class WithdrawResponse {
  @ApiProperty({ type: WalletResponse })
  wallet!: WalletResponse;

  @ApiProperty({ type: WalletTransactionResponse })
  transaction!: WalletTransactionResponse;
}
