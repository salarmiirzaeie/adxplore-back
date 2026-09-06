import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AUDIENCE_PROOF_MAX_IMAGES } from '../common/audience-proof';
import { UserProfileResponse } from '../common/swagger-responses';
import type { User } from '../generated/prisma/client';
import { UPLOAD_MAX_BYTES } from '../media/uploads.service';
import { InstagramApprovalResponse } from './dto/instagram-approval-response';
import { PublicProfileResponse } from './dto/public-profile-response';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: UserProfileResponse })
  me(@CurrentUser() user: User) {
    return this.users.serialize(user);
  }

  @Get('me/instagram-approval')
  @ApiOperation({
    summary:
      'Influencer PWA/TWA: follow @adxplore.ir, copy DM message/code, then wait for approval',
  })
  @ApiOkResponse({ type: InstagramApprovalResponse })
  instagramApproval(@CurrentUser() user: User) {
    return this.users.getInstagramApproval(user);
  }

  @Post('me/instagram-approval/confirm-sent')
  @ApiOperation({
    summary:
      'Influencer tapped «پیام را فرستادم» after following and DMing the verify code',
  })
  @ApiOkResponse({ type: InstagramApprovalResponse })
  confirmInstagramDmSent(@CurrentUser() user: User) {
    return this.users.markInstagramDmSent(user);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ type: UserProfileResponse })
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Post('me/photo')
  @ApiOperation({ summary: 'Upload profile photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: UserProfileResponse })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: UPLOAD_MAX_BYTES },
    }),
  )
  uploadPhoto(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.users.updatePhoto(user, file);
  }

  @Delete('me/photo')
  @ApiOperation({ summary: 'Remove profile photo' })
  @ApiOkResponse({ type: UserProfileResponse })
  removePhoto(@CurrentUser() user: User) {
    return this.users.removePhoto(user);
  }

  @Post('me/audience-proofs')
  @ApiOperation({
    summary:
      'Upload Instagram insights / audience screenshots (influencer). Shown to brands.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  @ApiOkResponse({ type: UserProfileResponse })
  @UseInterceptors(
    FilesInterceptor('files', AUDIENCE_PROOF_MAX_IMAGES, {
      storage: memoryStorage(),
      limits: { fileSize: UPLOAD_MAX_BYTES },
    }),
  )
  addAudienceProofs(
    @CurrentUser() user: User,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.users.addAudienceProofs(user, files);
  }

  @Delete('me/audience-proofs/:proofId')
  @ApiOperation({ summary: 'Remove an audience / analytics screenshot' })
  @ApiOkResponse({ type: UserProfileResponse })
  removeAudienceProof(
    @CurrentUser() user: User,
    @Param('proofId') proofId: string,
  ) {
    return this.users.removeAudienceProof(user, proofId);
  }

  @Get(':id/profile')
  @ApiOperation({
    summary:
      'Public brand or influencer profile (no phone). From chat, campaign, or marketplace.',
  })
  @ApiOkResponse({ type: PublicProfileResponse })
  getPublicProfile(@CurrentUser() user: User, @Param('id') id: string) {
    return this.users.getPublicProfile(user, id);
  }
}
