import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { InvitationStatus } from '../../generated/prisma/client';

export class UpdateInvitationStatusDto {
  @ApiProperty({
    enum: [InvitationStatus.CANCELLED],
    example: InvitationStatus.CANCELLED,
  })
  @IsIn([InvitationStatus.CANCELLED])
  status!: typeof InvitationStatus.CANCELLED;
}
