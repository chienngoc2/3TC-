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

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { StaffShiftsService } from './staff-shifts.service';
import { ShiftDto, UpdateShiftDto } from '../operations/dto/operations.dto';
@Controller('staff-shifts')
@Roles(UserRole.CENTER_MANAGER)
@ApiTags('Staff shifts')
@ApiBearerAuth()
export class StaffShiftsController {
  constructor(private readonly service: StaffShiftsService) {}
  @Get() list() {
    return this.service.list();
  }
  @Roles(UserRole.RECEPTIONIST) @Get('mine') mine(@CurrentUser() actor: Actor) {
    return this.service.list(actor.userId);
  }
  @Post() create(@Body() dto: ShiftDto, @CurrentUser() actor: Actor) {
    return this.service.create(dto, actor);
  }
  @Put(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.update(id, dto, actor);
  }
  @Delete(':id') delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.delete(id, actor);
  }
}
