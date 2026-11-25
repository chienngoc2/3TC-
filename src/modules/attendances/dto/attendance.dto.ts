import {
  IsUUID,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class AttendanceHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by member ID' })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD or ISO)' })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD or ISO)' })
  @IsOptional()
  to?: string;
}
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

export class QrCheckinDto {
  @IsString()
  qrToken: string;
}

export class ManualPinCheckinDto {
  @IsString()
  phone: string;

  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'Mã PIN bảo mật phải gồm 4 đến 6 chữ số' })
  checkinCode: string;

  @IsOptional()
  @IsEnum({
    MALE_LOCKER: 'MALE_LOCKER',
    FEMALE_LOCKER: 'FEMALE_LOCKER',
    VIP_AREA: 'VIP_AREA',
  })
  lockerZone?: string;

  @IsOptional()
  @IsBoolean()
  towelIssued?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
