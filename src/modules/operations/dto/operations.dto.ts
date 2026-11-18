import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  IsNumber,
  MaxLength,
  IsArray,
  ArrayUnique,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LockerStatus } from '@prisma/client';
import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { DateRangeQueryDto } from '../../../common/dto/pagination.dto';
export class DisciplineDto {
  @IsString() @MaxLength(50) code: string;
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsString() description?: string;
}
export class SpecialtyDto {
  @IsUUID() disciplineId: string;
  @IsString() @MaxLength(50) code: string;
  @IsString() @MaxLength(150) name: string;
  @IsOptional() @IsString() description?: string;
}
export class UpdateSpecialtyDto extends PartialType(SpecialtyDto, {
  skipNullProperties: false,
}) {}
export class AssignSpecialtiesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  specialtyIds: string[];
}
export class RoomDto {
  @IsString() @MaxLength(100) name: string;
  @IsInt() @Min(1) @Max(1000) capacity: number;
  @IsOptional() @IsString() locationNote?: string;
}
export class UpdateRoomDto extends PartialType(RoomDto, {
  skipNullProperties: false,
}) {}
export class EquipmentDto {
  @IsUUID() roomId: string;
  @IsString() @MaxLength(150) name: string;
  @IsString() @MaxLength(50) equipmentType: string;
}
export class UpdateEquipmentDto extends PartialType(EquipmentDto, {
  skipNullProperties: false,
}) {}
export class ClassDto {
  @IsUUID() disciplineId: string;
  @IsString() @MaxLength(150) name: string;
  @IsOptional() @IsString() description?: string;
}
export class UpdateClassDto extends PartialType(ClassDto, {
  skipNullProperties: false,
}) {}
export class SlotDto {
  @IsDateString() startTime: string;
  @IsDateString() endTime: string;
}
export class BulkCreateSlotsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots: SlotDto[];
}
export class RateDto {
  @IsUUID() disciplineId: string;
  @IsNumber() @Min(0) ratePerSession: number;
  @IsDateString({ strict: true }) effectiveFrom: string;
  @IsOptional() @IsDateString({ strict: true }) effectiveTo?: string;
}
export class UpdateRateDto extends PartialType(RateDto, {
  skipNullProperties: false,
}) {}

export class ShiftQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Filter by staff ID' })
  @IsOptional()
  @IsUUID()
  staffId?: string;
}

export class SlotQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Filter by coach ID' })
  @IsOptional()
  @IsUUID()
  coachId?: string;
}

export class ShiftDto extends SlotDto {
  @IsUUID() staffId: string;
  @IsDateString() shiftDate: string;
  @IsOptional() @IsString() notes?: string;
}
export class UpdateShiftDto extends PartialType(ShiftDto, {
  skipNullProperties: false,
}) {}
export class BulkCreateShiftsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiftDto)
  shifts: ShiftDto[];
}
export class CloneWeeklyShiftsDto {
  @IsDateString() sourceWeekStart: string;
  @IsDateString() targetWeekStart: string;
}
export class LockerDto {
  @IsString() @MaxLength(20) lockerNumber: string;
  @IsEnum({
    MALE_LOCKER: 'MALE_LOCKER',
    FEMALE_LOCKER: 'FEMALE_LOCKER',
    VIP_AREA: 'VIP_AREA',
  })
  zone: string;
}
export class LockerStatusDto {
  @IsEnum(LockerStatus) status: LockerStatus;
}
export class InbodyDto {
  @IsUUID() userId: string;
  @IsNumber() @Min(1) @Max(300) heightCm: number;
  @IsNumber() @Min(1) @Max(500) weightKg: number;
  @IsOptional() @IsNumber() @Min(0) @Max(500) muscleMassKg?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(500) skeletalMuscleMassKg?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bodyFatPct?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(500) bodyFatMassKg?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(500) leanBodyMassKg?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bmi?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) tbwLiters?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) proteinKg?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(50) mineralKg?: number;
  @IsOptional() @IsInt() @Min(0) @Max(30) visceralFatLevel?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(3) waistHipRatio?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) inbodyScore?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000) bmrKcal?: number;
  @IsOptional() segmentalLean?: any;
  @IsOptional() @IsString() notes?: string;
}
export class UpdateInbodyDto extends PartialType(InbodyDto, {
  skipNullProperties: false,
}) {}
