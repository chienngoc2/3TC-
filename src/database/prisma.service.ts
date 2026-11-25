import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        this.logger.log('Prisma successfully connected to PostgreSQL database');
        return;
      } catch (error) {
        retries--;
        this.logger.warn(
          `Failed to connect to database via Prisma. Retrying... (${retries} attempts left)`,
        );
        if (retries === 0) {
          this.logger.error(
            'Failed to connect to database via Prisma after all retries',
            error,
          );
          throw error;
        }
        await new Promise((res) => setTimeout(res, 2000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from PostgreSQL database');
  }
}
