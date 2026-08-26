import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { DealsModule } from '../deals/deals.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [NotificationsModule, DealsModule, ChatModule],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
