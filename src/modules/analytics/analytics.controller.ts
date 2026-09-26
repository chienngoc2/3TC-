import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
@Controller('analytics')
@ApiTags('Analytics')
@ApiBearerAuth()
@Roles(UserRole.CENTER_MANAGER)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}
  @Get('revenue') revenue() {
    return this.service.revenue();
  }
  @Get('manager-summary') summary() {
    return this.service.summary();
  }
  @Get('kpi') kpi() {
    return this.service.kpi();
  }
  @Roles(UserRole.ADMIN) @Get('system-metrics') metrics() {
    return {
      uptimeSeconds: process.uptime(),
      cpuUsageMicroseconds: process.cpuUsage(),
      memoryUsageBytes: process.memoryUsage(),
      nodeVersion: process.version,
    };
  }
}
