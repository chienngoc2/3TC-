import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class SendGoogleOtpDto {
  @ApiProperty({ example: 'member@gmail.com', description: 'Email Google cần gửi mã OTP' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: 'Nguyen Van A', required: false, description: 'Họ và tên người dùng' })
  @IsOptional()
  @IsString()
  fullName?: string;
}

export class VerifyGoogleOtpDto {
  @ApiProperty({ example: 'member@gmail.com', description: 'Email Google đã nhận mã OTP' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: '123456', description: 'Mã OTP 6 chữ số' })
  @IsString()
  @IsNotEmpty({ message: 'Mã OTP không được để trống' })
  @Length(6, 6, { message: 'Mã OTP phải gồm chính xác 6 chữ số' })
  otp: string;

  @ApiProperty({ example: 'Nguyen Van A', required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
