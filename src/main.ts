import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';
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

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const swaggerUser = process.env.SWAGGER_USER || 'admin';
    const swaggerPassword = process.env.SWAGGER_PASSWORD;

    if (swaggerPassword) {
      app.use(
        ['/docs', '/docs-json', '/docs-yaml'],
        basicAuth({
          challenge: true,
          users: {
            [swaggerUser]: swaggerPassword,
          },
        }),
      );
    }

    const config = new DocumentBuilder()
      .setTitle('Sports Center Management API')
      .setDescription(
        'V5 backend: five roles, transactional bookings and authenticated realtime.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, config),
      {
        swaggerOptions: {
          persistAuthorization: true,
        },
      },
    );
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`API is running on port ${port} (/api/v1); Swagger: /docs`);
}
void bootstrap();
