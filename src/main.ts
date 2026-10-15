import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './config/configure-app';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { rawBody: true });

  configureApp(app);

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
      .split(',')
      .map((value) => value.trim()),
    credentials: true,
  });

  app.enableShutdownHooks();
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Tuỳ chọn: Cho phép tắt Swagger trên Production nếu RAM quá căng (mặc định vẫn bật)
  if (process.env.SWAGGER_ENABLED !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('Sports Center Management API')
      .setDescription(
        'V5 backend: five roles, transactional bookings and authenticated realtime.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT) || 3000;

  // BẮT BUỘC trên Render: Bind vào 0.0.0.0 để Render port scanner nhận diện ngay lập tức
  await app.listen(port, '0.0.0.0');

  logger.log(`API is running on port ${port} (/api/v1); Swagger: /docs`);
}
void bootstrap();