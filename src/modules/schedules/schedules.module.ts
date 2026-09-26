import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseUUIDPipe, Module } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { SchedulesService } from './schedules.service';
import { ScheduleDto, UpdateScheduleDto } from '../commerce/dto/commerce.dto';
@Controller() @ApiTags('Schedules') @ApiBearerAuth()
class SchedulesController {
 constructor(private readonly service: SchedulesService) {}

 @Get('schedules') list() { return this.service.list(); }
 @Roles(UserRole.CENTER_MANAGER) @Post('schedules') create(@Body() dto: ScheduleDto, @CurrentUser() actor: Actor) { return this.service.create(dto, actor); }
 @Roles(UserRole.CENTER_MANAGER) @Put('schedules/:id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScheduleDto, @CurrentUser() actor: Actor) { return this.service.update(id, dto, actor); }
 @Roles(UserRole.CENTER_MANAGER) @Delete('schedules/:id') remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Actor) { return this.service.delete(id, actor); }

}
@Module({ controllers: [SchedulesController], providers: [SchedulesService], exports: [SchedulesService] })
export class SchedulesModule {}
