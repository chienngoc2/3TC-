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
import { Public } from '../../common/decorators/public.decorator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { SchedulesService } from './schedules.service';
import {
  ScheduleDto,
  ScheduleQueryDto,
  UpdateScheduleDto,
  ManagerScheduleOverrideDto,
} from '../commerce/dto/commerce.dto';
@Controller()
@ApiTags('Schedules')
@ApiBearerAuth()
export class SchedulesController {
  constructor(private readonly service: SchedulesService) {}

  @Public()
  @Get('schedules') list(@Query() query?: ScheduleQueryDto) {
    return this.service.list(query);
  }
  @Roles(UserRole.CENTER_MANAGER)
  @Get('schedules/manager-board')
  managerBoard(@Query() query?: ScheduleQueryDto) {
    return this.service.managerBoard(query);
  }
  @Roles(UserRole.CENTER_MANAGER) @Post('schedules') create(
    @Body() dto: ScheduleDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.create(dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Put('schedules/:id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.update(id, dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Delete('schedules/:id') remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.delete(id, actor);
  }

  @Roles(UserRole.CENTER_MANAGER, UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Get('schedules/:id/eligible-coaches') eligibleCoaches(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.eligibleCoaches(id);
  }

  @Roles(UserRole.CENTER_MANAGER, UserRole.ADMIN)
  @Post('schedules/:id/manager-override')
  managerOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ManagerScheduleOverrideDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.managerOverride(id, dto, actor);
  }

  @Roles(UserRole.CENTER_MANAGER, UserRole.ADMIN)
  @Post('schedules/check-thresholds')
  async checkThresholds() {
    const underEnrolled = await this.service.autoCancelUnderEnrolledSchedules();
    const emergencyUnsubstituted = await this.service.autoCancelUnsubstitutedEmergencySchedules();
    return {
      underEnrolled,
      emergencyUnsubstituted,
    };
  }

  @Get('peak-hours')
  listPeakHours() {
    return this.service.listPeakHours();
  }
  @Roles(UserRole.CENTER_MANAGER)
  @Post('peak-hours')
  createPeakHour(@Body() body: any) {
    return this.service.createPeakHour(body);
  }
  @Roles(UserRole.CENTER_MANAGER)
  @Put('peak-hours/:id')
  updatePeakHour(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.service.updatePeakHour(id, body);
  }
  @Roles(UserRole.CENTER_MANAGER)
  @Delete('peak-hours/:id')
  deletePeakHour(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deletePeakHour(id);
  }
}
