import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    example: 'سلام، جزئیات بیشتر کمپین را بفرستید',
    required: false,
    description: 'Text caption. Optional when sending an image or video file.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}
