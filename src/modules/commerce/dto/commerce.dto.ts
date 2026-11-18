import {
  IsUUID,
  IsString,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
  IsInt,
  Max,
  IsEnum,
  IsBoolean,
  IsDateString,
  MinLength,
} from 'class-validator';
import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PackageTier,
  TrainingMode,
  PlanType,
  PaymentMethod,
  SubscriptionStatus,
  CancellationTargetType,
  CancellationRequestStatus,
  BookingStatus,
} from '@prisma/client';
import {
  PaginationQueryDto,
  DateRangeQueryDto,
} from '../../../common/dto/pagination.dto';

export class BookingListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

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

export class CancellationRequestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CancellationRequestStatus })
  @IsOptional()
  @IsEnum(CancellationRequestStatus)
  status?: CancellationRequestStatus;
}
export class PlanDto {
  @IsUUID() disciplineId: string;
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price: number;
  @IsInt() @Min(1) @Max(3650) durationDays: number;
  @IsEnum(PackageTier) packageTier: PackageTier;
  @IsEnum(TrainingMode) trainingMode: TrainingMode;
  @IsOptional() @IsEnum(PlanType) planType?: PlanType;
  @IsInt() @Min(0) @Max(10000) groupSessionQuota: number;
  @IsInt() @Min(0) @Max(10000) ptSessionQuota: number;
  @IsBoolean() unlimitedGymEntry: boolean;
}
export class UpdatePlanDto extends PartialType(PlanDto, {
  skipNullProperties: false,
}) {}
export class PurchaseDto {
  @IsUUID() memberId: string;
  @IsUUID() planId: string;
  @IsOptional() @IsUUID() coachId?: string;
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(100) transactionRef?: string;
}
export class RenewDto {
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(100) transactionRef?: string;
}
export class VipPurchaseDto extends OmitType(PurchaseDto, [
  'memberId',
] as const) {
  @IsUUID() userId: string;
}
export class ApiAddonDto extends RenewDto {
  @IsInt() @Min(1) @Max(100) addonSessions: number;
}
export class AddonDto extends RenewDto {
  @IsInt() @Min(1) @Max(100) sessions: number;
}
export class SubscriptionStatusDto {
  @IsEnum(SubscriptionStatus) status: SubscriptionStatus;
}

export class ScheduleQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Filter by coach ID' })
  @IsOptional()
  @IsUUID()
  coachId?: string;

  @ApiPropertyOptional({ description: 'Filter by discipline ID' })
  @IsOptional()
  @IsUUID()
  disciplineId?: string;

  @ApiPropertyOptional({ description: 'Filter by class ID' })
  @IsOptional()
  @IsUUID()
  classId?: string;
}

export class ScheduleDto {
  @IsUUID() classId: string;
  @IsUUID() roomId: string;
  @IsUUID() coachId: string;
  @IsDateString() startTime: string;
  @IsDateString() endTime: string;
  @IsInt() @Min(1) @Max(1000) capacity: number;
}
export class UpdateScheduleDto extends PartialType(ScheduleDto, {
  skipNullProperties: false,
}) {}
export class GroupBookingDto {
  @IsUUID() scheduleId: string;
  @IsOptional() @IsUUID() memberId?: string;
  @IsOptional() @IsUUID() equipmentId?: string;
}
export class PtBookingDto {
  @IsUUID() coachAvailabilityId: string;
  @IsUUID() disciplineId: string;
  @IsOptional() @IsUUID() memberId?: string;
  @IsOptional() @IsUUID() equipmentId?: string;
}
export class CancelDto {
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}
export class CancellationRequestDto {
  @IsOptional() @IsUUID() coachId?: string;
  @IsOptional()
  @IsEnum(CancellationTargetType)
  targetType?: CancellationTargetType;
  @IsOptional() @IsUUID() bookingId?: string;
  @IsOptional() @IsUUID() scheduleId?: string;
  @IsString() @MinLength(20) @MaxLength(2000) reasonMessage: string;
  @IsOptional() @IsString() @MaxLength(5000) internalNote?: string;
}
export class ReviewDto {
  @IsOptional() @IsBoolean() approve?: boolean;
  @IsOptional() @IsEnum({ APPROVE: 'APPROVE', REJECT: 'REJECT' }) action?:
    'APPROVE' | 'REJECT';
  @IsOptional() @IsString() @MaxLength(2000) rejectionReason?: string;
}
export class PenaltyReviewDto {
  @IsString() @MinLength(5) @MaxLength(2000) decision: string;
}
