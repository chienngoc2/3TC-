import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh'`;
            return work(tx);
          },
          {
            isolationLevel: 'Serializable',
            timeout: 20000,
            maxWait: 10000,
          },
        );
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'P2034' && attempt < 3) {
          await new Promise((resolve) =>
            setTimeout(resolve, 20 * (attempt + 1)),
          );
          continue;
        }
        if (['P2002', 'P2003', 'P2004', 'P2034'].includes(code ?? ''))
          throw new ConflictException('DATA_CONFLICT');
        // Prisma 5 reports exclusion constraints/trigger errors as UnknownRequestError.
        const message = error instanceof Error ? error.message : '';
        if (/23P01|exclusion constraint|P0001|overlap|conflict/i.test(message))
          throw new ConflictException('SCHEDULE_OR_DATA_CONFLICT');
        if (code === 'P2010') {
          const detail = (error as { meta?: { code?: string } }).meta?.code;
          if (['23P01', '23505', '23503', 'P0001'].includes(detail ?? ''))
            throw new ConflictException('SCHEDULE_OR_DATA_CONFLICT');
        }
        throw error;
      }
    }
  }
}
