import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserGender, UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'coach1@sportscenter.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  password: string;

  @ApiProperty({ example: 'Tran Coach' })
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName: string;

  @ApiProperty({ example: '0987654321', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ enum: UserRole, default: UserRole.MEMBER })
  @IsEnum(UserRole, { message: 'Vai trò người dùng không hợp lệ' })
  @IsOptional()
  role: UserRole = UserRole.MEMBER;

  @ApiProperty({ enum: UserGender, default: UserGender.OTHER, required: false })
  @IsEnum(UserGender, { message: 'Giới tính không hợp lệ' })
  @IsOptional()
  gender?: UserGender = UserGender.OTHER;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({ required: false, description: 'Tên ngân hàng của HLV' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({ required: false, description: 'Số tài khoản ngân hàng' })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiProperty({ required: false, description: 'Tên chủ thẻ/tài khoản' })
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiProperty({ required: false, description: 'Các thứ rảnh trong tuần (e.g. MONDAY, WEDNESDAY, FRIDAY)' })
  @IsOptional()
  workingDays?: string[];

  @ApiProperty({ required: false, description: 'Khung giờ rảnh đăng ký' })
  @IsOptional()
  workingHours?: Array<{ shift?: string; from: string; to: string; day?: string }>;

  @ApiProperty({ required: false, description: 'Đánh giá sao của HLV (1-5 sao)' })
  @IsOptional()
  ratingStars?: number;

  @ApiProperty({ required: false, description: 'Lương thù lao theo buổi (VNĐ)' })
  @IsOptional()
  ratePerSession?: number;

  @ApiProperty({ required: false, description: 'Danh sách ID chuyên môn / môn thể thao' })
  @IsOptional()
  specialtyIds?: string[];

  @ApiProperty({ required: false, description: 'Gmail cá nhân của HLV để nhận thông tin tài khoản' })
  @IsOptional()
  @IsString()
  personalEmail?: string;
}
