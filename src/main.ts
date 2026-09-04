import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  app.setGlobalPrefix('v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const corsOrigin = config.get<string>('CORS_ORIGIN', '');
  const allowedOrigins = expandCorsOrigins(corsOrigin);

  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser clients (curl, server-to-server) send no Origin.
      if (!origin || allowedOrigins.size === 0) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AdXplore API')
    .setDescription(
      'AdXplore (ادکسپلور) — Iranian DIY Instagram influencer marketplace API',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('health')
    .addTag('auth')
    .addTag('users')
    .addTag('campaigns')
    .addTag('influencers')
    .addTag('invitations')
    .addTag('offers')
    .addTag('deals')
    .addTag('payments')
    .addTag('wallets')
    .addTag('chat')
    .addTag('notifications')
    .addTag('support')
    .addTag('admin')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/json',
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`AdXplore API listening on http://localhost:${port}/v1`);
  console.log(`Swagger UI: http://localhost:${port}/docs`);
}

/** Allow both http and https for every host listed in CORS_ORIGIN. */
function expandCorsOrigins(raw: string): Set<string> {
  const expanded = new Set<string>();
  for (const origin of raw.split(',').map((o) => o.trim()).filter(Boolean)) {
    expanded.add(origin);
    try {
      const { host } = new URL(origin);
      expanded.add(`http://${host}`);
      expanded.add(`https://${host}`);
    } catch {
      // Keep the raw value if it is not a valid URL.
    }
  }
  return expanded;
}

void bootstrap();
