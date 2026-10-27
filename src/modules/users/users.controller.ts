import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto, UpdateUserDto } from './dto/update-profile.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Post()
  @Roles(UserRole.ADMIN, UserRole.CENTER_MANAGER)
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: Actor) {
    return this.users.createUser(dto, actor);
  }
  @Get('profile/me') me(@CurrentUser() actor: Actor) {
    return this.users.findById(actor.userId);
  }
  @Put('profile/me') profile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.users.updateProfile(actor.userId, dto, actor);
  }
  @Post('profile/me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  uploadAvatarMe(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: Actor,
  ) {
    return this.users.uploadAvatar(actor.userId, file, actor);
  }
  @Get('members')
  @Roles(UserRole.CENTER_MANAGER, UserRole.RECEPTIONIST)
  members(@Query('q') q?: string) {
    return this.users.findAll(UserRole.MEMBER, q);
  }
  @Post('members')
  @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  registerMember(@Body() dto: CreateUserDto, @CurrentUser() actor: Actor) {
    return this.users.createUser(
      { ...dto, role: dto.role ?? UserRole.MEMBER },
      actor,
    );
  }
  @Put('members/:id')
  @Roles(UserRole.CENTER_MANAGER, UserRole.RECEPTIONIST)
  memberProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.users.updateProfile(id, dto, actor);
  }
  @Post('members/:id/avatar')
  @Roles(UserRole.ADMIN, UserRole.CENTER_MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  uploadAvatarMember(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: Actor,
  ) {
    return this.users.uploadAvatar(id, file, actor);
  }
  @Get('staff')
  @Roles(UserRole.CENTER_MANAGER)
  staff() {
    return Promise.all([
      this.users.findAll(UserRole.COACH),
      this.users.findAll(UserRole.RECEPTIONIST),
    ]).then((rows) => rows.flat());
  }
  @Put('staff/:id')
  @Roles(UserRole.CENTER_MANAGER)
  staffUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.users.updateUser(id, dto, actor);
  }
  @Delete('staff/:id')
  @Roles(UserRole.CENTER_MANAGER)
  disableStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.users.updateUser(id, { isActive: false }, actor);
  }
  @Get('center-managers') @Roles(UserRole.ADMIN) managers() {
    return this.users.findAll(UserRole.CENTER_MANAGER);
  }
  @Post('center-managers')
  @Roles(UserRole.ADMIN)
  managerCreate(@Body() dto: CreateUserDto, @CurrentUser() actor: Actor) {
    return this.users.createUser(
      { ...dto, role: UserRole.CENTER_MANAGER },
      actor,
    );
  }
  @Put('center-managers/:id')
  @Roles(UserRole.ADMIN)
  managerUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.users.updateUser(id, dto, actor, UserRole.CENTER_MANAGER);
  }
  @Delete('center-managers/:id')
  @Roles(UserRole.ADMIN)
  managerDisable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.users.updateUser(
      id,
      { isActive: false },
      actor,
      UserRole.CENTER_MANAGER,
    );
  }
  @Get(':id')
  @Roles(UserRole.CENTER_MANAGER, UserRole.RECEPTIONIST, UserRole.COACH)
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Actor) {
    return this.users.findById(id, actor);
  }
}
