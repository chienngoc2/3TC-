import {
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsArray,
  ArrayMaxSize,
  IsUrl,
  IsBoolean,
  MinLength,
  IsEnum,
  Matches,
} from 'class-validator';
import { UserGender } from '@prisma/client';
export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(150) fullName?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'Mã PIN check-in bảo mật phải là 4 đến 6 chữ số' })
  checkinCode?: string;
  @IsOptional() @IsString() currentPassword?: string;
  @IsOptional()
  @IsEnum(UserGender, { message: 'Giới tính không hợp lệ' })
  gender?: UserGender;
  @IsOptional() @IsString() @MaxLength(4000) fitnessGoals?: string;
  @IsOptional() @IsString() @MaxLength(4000) medicalHistory?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(300) heightCm?: number;
  @IsOptional() @IsString() @MaxLength(4000) bio?: string;
  @IsOptional() @IsInt() @Min(0) @Max(80) yearsExperience?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({}, { each: true })
  certificateUrls?: string[];
  @IsOptional() @IsString() @MaxLength(100) bankName?: string;
  @IsOptional() @IsString() @MaxLength(50) bankAccountNumber?: string;
  @IsOptional() @IsString() @MaxLength(150) bankAccountName?: string;
  @IsOptional() @IsArray() workingDays?: string[];
  @IsOptional() @IsArray() workingHours?: any[];
}
export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(150) fullName?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional()
  @IsEnum(UserGender, { message: 'Giới tính không hợp lệ' })
  gender?: UserGender;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) ratingStars?: number;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankAccountNumber?: string;
  @IsOptional() @IsString() bankAccountName?: string;
  @IsOptional() @IsArray() workingDays?: string[];
  @IsOptional() @IsArray() workingHours?: any[];
}
