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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { StaffShiftsService } from './staff-shifts.service';
import { DateRangeQueryDto } from '../../common/dto/pagination.dto';
import {
  ShiftDto,
  ShiftQueryDto,
  BulkCreateShiftsDto,
  UpdateShiftDto,
  CloneWeeklyShiftsDto,
} from '../operations/dto/operations.dto';
@Controller('staff-shifts')
@Roles(UserRole.CENTER_MANAGER)
@ApiTags('Staff shifts')
@ApiBearerAuth()
export class StaffShiftsController {
  constructor(private readonly service: StaffShiftsService) {}
  @Get() list(@Query() query?: ShiftQueryDto) {
    return this.service.list(query);
  }
  @Roles(UserRole.RECEPTIONIST, UserRole.COACH)
  @Get('mine')
  mine(@Query() query: DateRangeQueryDto, @CurrentUser() actor: Actor) {
    return this.service.list({ ...query, staffId: actor.userId });
  }
  @Post() create(@Body() dto: ShiftDto, @CurrentUser() actor: Actor) {
    return this.service.create(dto, actor);
  }
  @Post('bulk') createBulk(
    @Body() dto: BulkCreateShiftsDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.createBulk(dto, actor);
  }
  @Post('clone-weekly') cloneWeekly(
    @Body() dto: CloneWeeklyShiftsDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.cloneWeekly(dto, actor);
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
