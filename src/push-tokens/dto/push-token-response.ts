import { ApiProperty } from '@nestjs/swagger';
import { PushPlatform } from '../../generated/prisma/client';

export class PushTokenResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  token!: string;

  @ApiProperty({ enum: PushPlatform })
  platform!: PushPlatform;
}
