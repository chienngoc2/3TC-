import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(UserRole.ADMIN, UserRole.CENTER_MANAGER)
  @Post()
  @ApiOperation({ summary: 'Tạo tài khoản mới (Admin tạo CM/Coach; CM tạo Staff/Coach)' })
  async createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.CENTER_MANAGER, UserRole.RECEPTIONIST)
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách người dùng (Admin, Center Manager, Receptionist)' })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  async findAll(@Query('role') role?: UserRole) {
    return this.usersService.findAll(role);
  }

  @Get('profile/me')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại' })
  async getMyProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.findById(userId);
  }

  @Roles(UserRole.ADMIN, UserRole.CENTER_MANAGER, UserRole.RECEPTIONIST, UserRole.COACH)
  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết người dùng theo ID' })
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}

