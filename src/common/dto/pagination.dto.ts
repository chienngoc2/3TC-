import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Response } from 'express';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (starts from 1)',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD or ISO string)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD or ISO string)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export function parsePagination(query?: PaginationQueryDto): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = query?.page && query.page > 0 ? Number(query.page) : 1;
  const limit =
    query?.limit && query.limit > 0 ? Math.min(Number(query.limit), 100) : 20;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function applyPaginationHeaders(
  res: Response,
  total: number,
  page: number,
  limit: number,
): void {
  if (!res || typeof res.setHeader !== 'function') return;
  const totalPages = Math.ceil(total / limit) || 1;
  res.setHeader('x-total-count', total.toString());
  res.setHeader('x-page', page.toString());
  res.setHeader('x-limit', limit.toString());
  res.setHeader('x-total-pages', totalPages.toString());
}
