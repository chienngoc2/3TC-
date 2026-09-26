import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseUUIDPipe, Module } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { StaffShiftsService } from './staff-shifts.service';
import { ShiftDto, UpdateShiftDto } from '../operations/dto/operations.dto';
@Controller('staff-shifts') @Roles(UserRole.CENTER_MANAGER) @ApiTags('Staff shifts') @ApiBearerAuth()
class StaffShiftsController {
 constructor(private readonly service: StaffShiftsService) {}
 @Get() list() { return this.service.list(); }
 @Post() create(@Body() dto: ShiftDto, @CurrentUser() actor: Actor) { return this.service.create(dto, actor); }
 @Put(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShiftDto, @CurrentUser() actor: Actor) { return this.service.update(id, dto, actor); }
 @Delete(':id') delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Actor) { return this.service.delete(id, actor); }
}
@Module({ controllers: [StaffShiftsController], providers: [StaffShiftsService], exports: [StaffShiftsService] })
export class StaffShiftsModule {}
