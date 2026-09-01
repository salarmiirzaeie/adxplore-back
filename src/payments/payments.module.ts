import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ZarinpalService } from './zarinpal.service';

@Module({
  imports: [NotificationsModule, ChatModule, WalletsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, ZarinpalService],
  exports: [PaymentsService, ZarinpalService],
})
export class PaymentsModule {}
