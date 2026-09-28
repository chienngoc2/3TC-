import { CheckoutKind, CheckoutStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCheckoutDto {
  @IsEnum(CheckoutKind) kind: CheckoutKind;
  @IsOptional() @IsUUID() planId?: string;
  @IsOptional() @IsUUID() coachId?: string;
  @IsOptional() @IsUUID() subscriptionId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) addonSessions?: number;
}

export class CheckoutListDto {
  @IsOptional() @IsEnum(CheckoutStatus) status?: CheckoutStatus;
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class AddonPreviewQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) sessions: number;
}
