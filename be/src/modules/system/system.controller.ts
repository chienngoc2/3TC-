import {
  Controller,
  Get,
  Query,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  PaginationQueryDto,
  parsePagination,
  applyPaginationHeaders,
} from '../../common/dto/pagination.dto';
import { getVietnamDateRange } from '../../common/utils/timezone';

export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by action' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by target entity' })
  @IsOptional()
  @IsString()
  targetEntity?: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD or ISO)' })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD or ISO)' })
  @IsOptional()
  to?: string;
}

@Controller()
export class SystemController {
  constructor(private readonly prisma: PrismaService) {}
  @Public() @Get('health') async health() {
    const results = await Promise.allSettled([this.prisma.$queryRaw`SELECT 1`]);
    const data = {
      database: results[0].status === 'fulfilled' ? 'UP' : 'DOWN',
      uptimeSeconds: process.uptime(),
    };
    if (results.some((result) => result.status === 'rejected'))
      throw new ServiceUnavailableException({
        message: 'DEPENDENCY_UNAVAILABLE',
        ...data,
      });
    return { status: 'UP', ...data };
  }
  @Roles(UserRole.ADMIN)
  @Get('audit-logs')
  async audit(
    @Query() query: AuditLogQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { page, limit, skip } = parsePagination(query);
    const { startUtc, endUtc } = getVietnamDateRange(query?.from, query?.to);
    const where = {
      ...(query?.action ? { action: query.action } : {}),
      ...(query?.targetEntity ? { targetEntity: query.targetEntity } : {}),
      ...(startUtc || endUtc
        ? {
            createdAt: {
              ...(startUtc ? { gte: startUtc } : {}),
              ...(endUtc ? { lte: endUtc } : {}),
            },
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    applyPaginationHeaders(res, total, page, limit);
    return items;
  }
}
