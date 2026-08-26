import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'سلام، جزئیات بیشتر کمپین را بفرستید' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
