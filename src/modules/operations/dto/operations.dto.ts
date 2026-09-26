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
} from 'class-validator';
import { LockerStatus } from '@prisma/client';
import { PartialType } from '@nestjs/swagger';
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
export class UpdateSpecialtyDto extends PartialType(SpecialtyDto) {}
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
export class UpdateRoomDto extends PartialType(RoomDto) {}
export class EquipmentDto {
  @IsUUID() roomId: string;
  @IsString() @MaxLength(150) name: string;
  @IsString() @MaxLength(50) equipmentType: string;
}
export class UpdateEquipmentDto extends PartialType(EquipmentDto) {}
export class ClassDto {
  @IsUUID() disciplineId: string;
  @IsString() @MaxLength(150) name: string;
  @IsOptional() @IsString() description?: string;
}
export class UpdateClassDto extends PartialType(ClassDto) {}
export class SlotDto {
  @IsDateString() startTime: string;
  @IsDateString() endTime: string;
}
export class RateDto {
  @IsNumber() @Min(0) ratePerSession: number;
  @IsDateString({ strict: true }) effectiveFrom: string;
  @IsOptional() @IsDateString({ strict: true }) effectiveTo?: string;
}
export class UpdateRateDto extends PartialType(RateDto) {}
export class ShiftDto extends SlotDto {
  @IsUUID() staffId: string;
  @IsDateString() shiftDate: string;
  @IsOptional() @IsString() notes?: string;
}
export class UpdateShiftDto extends PartialType(ShiftDto) {}
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
  @IsOptional() @IsNumber() @Min(0) @Max(100) bodyFatPct?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bmi?: number;
  @IsOptional() @IsInt() @Min(0) visceralFatLevel?: number;
  @IsOptional() @IsString() notes?: string;
}
export class UpdateInbodyDto extends PartialType(InbodyDto) {}
