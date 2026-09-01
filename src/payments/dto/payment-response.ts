import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '../../generated/prisma/client';

export class PaymentResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  dealId!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  influencerId!: string;

  @ApiProperty({ example: 900_000 })
  amountToman!: number;

  @ApiProperty({ example: 9_000_000 })
  amountRial!: number;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  authority!: string | null;

  @ApiPropertyOptional({ nullable: true })
  refId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  cardPan!: string | null;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiPropertyOptional({ nullable: true })
  errorMessage!: string | null;

  @ApiPropertyOptional({ nullable: true })
  paidAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  releasedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaymentRequestResponse {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  paymentId!: string;

  @ApiProperty()
  authority!: string;

  @ApiProperty({ description: 'ZarinPal StartPay URL' })
  paymentUrl!: string;

  @ApiProperty()
  amountToman!: number;

  @ApiProperty()
  amountRial!: number;

  @ApiPropertyOptional()
  reused?: boolean;

  @ApiPropertyOptional()
  sandbox?: boolean;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;
}

export class PaymentStatusResponse {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  dealId!: string;

  @ApiProperty()
  offerId!: string;

  @ApiProperty()
  dealStatus!: string;

  @ApiProperty()
  paid!: boolean;

  @ApiProperty({ enum: PaymentStatus, nullable: true })
  paymentStatus!: PaymentStatus | null;

  @ApiPropertyOptional({ nullable: true })
  refId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  amountToman!: number | null;
}
