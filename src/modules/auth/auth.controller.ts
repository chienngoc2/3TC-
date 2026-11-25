import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SendGoogleOtpDto, VerifyGoogleOtpDto } from './dto/google-auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản hội viên mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập và nhận cặp JWT tokens' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới Access Token từ Refresh Token' })
  @ApiResponse({ status: 200, description: 'Cấp token mới thành công' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Public()
  @Post('google/send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi mã xác thực OTP qua email để đăng nhập Google' })
  @ApiResponse({ status: 200, description: 'Đã gửi mã OTP thành công qua email' })
  async sendGoogleOtp(@Body() dto: SendGoogleOtpDto) {
    return this.authService.sendGoogleOtp(dto);
  }

  @Public()
  @Post('google/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực OTP và đăng nhập tài khoản Google (tự tạo nếu mới)' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công, trả kèm thông tin tài khoản mặc định' })
  async verifyGoogleOtp(@Body() dto: VerifyGoogleOtpDto) {
    return this.authService.verifyGoogleOtp(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất và hủy phiên làm việc' })
  async logout(@CurrentUser() actor: Actor) {
    return this.authService.logout(actor);
  }
}
