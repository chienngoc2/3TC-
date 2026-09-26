import { Module, Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
@Controller()
class SystemController {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}
  @Public() @Get('health') async health() {
    const results = await Promise.allSettled([this.prisma.$queryRaw`SELECT 1`, this.redis.ping()]);
    const data = { database: results[0].status === 'fulfilled' ? 'UP' : 'DOWN', redis: results[1].status === 'fulfilled' ? 'UP' : 'DOWN', uptimeSeconds: process.uptime() };
    if (results.some(result => result.status === 'rejected')) throw new ServiceUnavailableException({ message: 'DEPENDENCY_UNAVAILABLE', ...data });
    return { status: 'UP', ...data };
  }
  @Roles(UserRole.ADMIN) @Get('audit-logs') audit() { return this.prisma.auditLog.findMany({ take: 100, orderBy: { createdAt: 'desc' } }); }
}
@Module({ controllers: [SystemController] }) export class SystemModule {}
