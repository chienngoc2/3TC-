import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { ClassesService } from './classes.service';
import {
  DisciplineDto,
  RoomDto,
  UpdateRoomDto,
  EquipmentDto,
  UpdateEquipmentDto,
  ClassDto,
  UpdateClassDto,
} from '../operations/dto/operations.dto';
@Controller()
@ApiTags('Facilities and classes')
@ApiBearerAuth()
export class ClassesController {
  constructor(private readonly service: ClassesService) {}
  @Public() @Get('disciplines') disciplines() {
    return this.service.disciplines();
  }
  @Roles(UserRole.CENTER_MANAGER) @Post('disciplines') discipline(
    @Body() dto: DisciplineDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.createDiscipline(dto, actor);
  }
  @Get('rooms') rooms() {
    return this.service.rooms();
  }
  @Roles(UserRole.CENTER_MANAGER) @Post('rooms') room(
    @Body() dto: RoomDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.createRoom(dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Put('rooms/:id') updateRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.updateRoom(id, dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Delete('rooms/:id') disableRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.disableRoom(id, actor);
  }
  @Get('equipment') equipment() {
    return this.service.equipment();
  }
  @Roles(UserRole.CENTER_MANAGER) @Post('equipment') machine(
    @Body() dto: EquipmentDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.createEquipment(dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Put('equipment/:id') updateMachine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEquipmentDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.updateEquipment(id, dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Delete('equipment/:id') disableMachine(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.disableEquipment(id, actor);
  }
  @Get('classes') classes() {
    return this.service.classes();
  }
  @Roles(UserRole.CENTER_MANAGER) @Post('classes') createClass(
    @Body() dto: ClassDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.createClass(dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Put('classes/:id') updateClass(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.updateClass(id, dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Delete('classes/:id') deleteClass(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.deleteClass(id, actor);
  }
}
