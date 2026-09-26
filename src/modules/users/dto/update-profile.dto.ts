import { IsOptional, IsString, MaxLength, IsNumber, Min, IsBoolean, MinLength } from 'class-validator';
export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(150) fullName?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(2000) avatarUrl?: string;
  @IsOptional() @IsString() @MaxLength(4000) fitnessGoals?: string;
  @IsOptional() @IsString() @MaxLength(4000) medicalHistory?: string;
  @IsOptional() @IsNumber() @Min(1) heightCm?: number;
}
export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(150) fullName?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(8) password?: string;
}
