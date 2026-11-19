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

  const envOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const defaultOrigins = [
    'https://3tcfitness.ddns.net',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!requestOrigin) {
        return callback(null, true);
      }
      // Direct match
      if (allowedOrigins.includes(requestOrigin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      // Dynamic match for production subdomains and localhost
      try {
        const url = new URL(requestOrigin);
        if (
          url.hostname === '3tcfitness.ddns.net' ||
          url.hostname.endsWith('.3tcfitness.ddns.net') ||
          url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1'
        ) {
          return callback(null, true);
        }
      } catch {
        // invalid url, reject
      }

      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Range',
    ],
    exposedHeaders: ['x-total-count', 'x-page', 'x-limit', 'x-total-pages'],
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
