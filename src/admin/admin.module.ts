import { Module } from '@nestjs/common';
import { InvitationsModule } from '../invitations/invitations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletsModule } from '../wallets/wallets.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [WalletsModule, NotificationsModule, InvitationsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
