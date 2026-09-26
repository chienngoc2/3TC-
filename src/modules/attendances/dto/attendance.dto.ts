import {
  IsUUID,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsString,
  MaxLength,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { OmitType } from '@nestjs/swagger';
export class GateEntryDto {
  @IsUUID() memberId: string;
  @IsOptional()
  @IsEnum({
    MALE_LOCKER: 'MALE_LOCKER',
    FEMALE_LOCKER: 'FEMALE_LOCKER',
    VIP_AREA: 'VIP_AREA',
  })
  lockerZone?: string;
  @IsOptional() @IsBoolean() towelIssued?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class ClassAttendanceDto {
  @IsUUID() bookingId: string;
  @IsEnum(AttendanceStatus) status: AttendanceStatus;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class UpdateAttendanceDto extends OmitType(ClassAttendanceDto, [
  'bookingId',
] as const) {}
export class GateCheckinDto {
  @IsUUID() userId: string;
  @IsOptional()
  @IsEnum({
    MALE_LOCKER: 'MALE_LOCKER',
    FEMALE_LOCKER: 'FEMALE_LOCKER',
    VIP_AREA: 'VIP_AREA',
  })
  preferredZone?: string;
  @IsOptional() @IsBoolean() towelIssued?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
