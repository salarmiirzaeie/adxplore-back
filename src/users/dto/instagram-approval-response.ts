import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InfluencerApprovalStatus } from '../../generated/prisma/client';

export class InstagramPageLinksDto {
  @ApiProperty({ example: 'adxplore.ir' })
  username!: string;

  @ApiProperty({ example: 'https://www.instagram.com/adxplore.ir/' })
  profileUrl!: string;

  @ApiProperty({ example: 'https://www.instagram.com/adxplore.ir/' })
  followUrl!: string;

  @ApiProperty({ example: 'https://ig.me/m/adxplore.ir' })
  dmUrl!: string;

  @ApiProperty({ example: 'instagram://user?username=adxplore.ir' })
  appProfileUrl!: string;

  @ApiProperty({ example: 'instagram://user?username=adxplore.ir' })
  appDmUrl!: string;

  @ApiProperty()
  androidProfileIntent!: string;

  @ApiProperty()
  androidDmIntent!: string;
}

export class InstagramActionLinkDto {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  appUrl!: string;

  @ApiProperty()
  androidIntent!: string;
}

export class InstagramCopyActionDto {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  text!: string;
}

export class InstagramConfirmSentActionDto {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  enabled!: boolean;
}

export class InstagramApprovalActionsDto {
  @ApiPropertyOptional({ type: InstagramCopyActionDto, nullable: true })
  copyMessage!: InstagramCopyActionDto | null;

  @ApiPropertyOptional({ type: InstagramCopyActionDto, nullable: true })
  copyCode!: InstagramCopyActionDto | null;

  @ApiProperty({ type: InstagramActionLinkDto })
  follow!: InstagramActionLinkDto;

  @ApiProperty({ type: InstagramActionLinkDto })
  openDm!: InstagramActionLinkDto;

  @ApiProperty({ type: InstagramConfirmSentActionDto })
  confirmSent!: InstagramConfirmSentActionDto;
}

export class InstagramApprovalCopyDto {
  @ApiProperty()
  headline!: string;

  @ApiProperty()
  subtitle!: string;

  @ApiProperty()
  waitingHint!: string;
}

export class InstagramApprovalStepDto {
  @ApiProperty({ example: 'follow' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({
    enum: ['OPEN_FOLLOW', 'COPY_MESSAGE', 'OPEN_DM', 'WAIT'],
  })
  action!: string;

  @ApiProperty()
  done!: boolean;
}

export class InstagramApprovalResponse {
  @ApiPropertyOptional({ enum: InfluencerApprovalStatus, nullable: true })
  approvalStatus!: InfluencerApprovalStatus | null;

  @ApiProperty({
    enum: [
      'ONBOARDING',
      'ACTION_REQUIRED',
      'WAITING_REVIEW',
      'APPROVED',
      'REJECTED',
    ],
  })
  uiStatus!: string;

  @ApiProperty()
  onboardingComplete!: boolean;

  @ApiProperty()
  canAccessPanel!: boolean;

  @ApiPropertyOptional({ example: 'ADX-K7M2P', nullable: true })
  verifyCode!: string | null;

  @ApiPropertyOptional({
    example: 'سلام، درخواست عضویت در ادکسپلور\nکد تأیید: ADX-K7M2P',
    nullable: true,
  })
  dmMessage!: string | null;

  @ApiPropertyOptional({ example: 'sara', nullable: true })
  influencerInstagram!: string | null;

  @ApiPropertyOptional({ nullable: true })
  rejectionReason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  markedSentAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt!: Date | null;

  @ApiProperty({ example: 15 })
  pollIntervalSeconds!: number;

  @ApiProperty({ type: InstagramPageLinksDto })
  page!: InstagramPageLinksDto;

  @ApiProperty({ type: InstagramApprovalCopyDto })
  copy!: InstagramApprovalCopyDto;

  @ApiProperty({ type: InstagramApprovalActionsDto })
  actions!: InstagramApprovalActionsDto;

  @ApiProperty({ type: InstagramApprovalStepDto, isArray: true })
  steps!: InstagramApprovalStepDto[];
}
