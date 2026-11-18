import { CheckoutKind, CheckoutStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCheckoutDto {
  @IsEnum(CheckoutKind) kind: CheckoutKind;
  @IsOptional() @IsUUID() memberId?: string;
  @IsOptional() @IsUUID() planId?: string;
  @IsOptional() @IsUUID() coachId?: string;
  @IsOptional() @IsUUID() subscriptionId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) addonSessions?: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CheckoutListDto {
  @IsOptional() @IsUUID() memberId?: string;
  @IsOptional() @IsEnum(CheckoutStatus) status?: CheckoutStatus;
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class InvoiceListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by member ID' })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD or ISO)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD or ISO)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AddonPreviewQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) sessions: number;
}
