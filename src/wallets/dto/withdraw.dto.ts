import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class WithdrawDto {
  @ApiProperty({ example: 500_000 })
  @Type(() => Number)
  @IsInt()
  @Min(10_000, { message: 'حداقل برداشت ۱۰٬۰۰۰ تومان است' })
  amountToman!: number;
}
