import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ChatModule } from './chat/chat.module';
import { DealsModule } from './deals/deals.module';
import { HealthController } from './health.controller';
import { InfluencersModule } from './influencers/influencers.module';
import { InvitationsModule } from './invitations/invitations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OffersModule } from './offers/offers.module';
import { PrismaModule } from './prisma/prisma.module';
import { SmsModule } from './sms/sms.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    UploadsModule,
    SmsModule,
    AuthModule,
    UsersModule,
    CampaignsModule,
    InfluencersModule,
    NotificationsModule,
    InvitationsModule,
    OffersModule,
    DealsModule,
    ChatModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
