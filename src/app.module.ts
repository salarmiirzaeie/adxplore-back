import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { HealthController } from './health.controller';
import { InfluencersModule } from './influencers/influencers.module';
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
