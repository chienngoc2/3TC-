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
import { CoachesService } from './coaches.service';
import {
  SlotDto,
  BulkCreateSlotsDto,
  RateDto,
  UpdateRateDto,
} from '../operations/dto/operations.dto';
@Controller('coaches')
@ApiTags('Coaches')
@ApiBearerAuth()
export class CoachesController {
  constructor(private readonly service: CoachesService) {}
  @Get() list() {
    return this.service.list();
  }
  @Get('availability') slots(
    @Query('coachId', new ParseUUIDPipe({ optional: true })) coachId?: string,
  ) {
    return this.service.slots(coachId);
  }
  @Roles(UserRole.COACH) @Get('availability/mine') mine(
    @CurrentUser() actor: Actor,
  ) {
    return this.service.ownSlots(actor);
  }
  @Roles(UserRole.COACH) @Post('availability') createSlot(
    @Body() dto: SlotDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.createSlot(dto, actor);
  }
  @Roles(UserRole.COACH) @Post('availability/bulk') createSlotsBulk(
    @Body() dto: BulkCreateSlotsDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.createSlotsBulk(dto, actor);
  }
  @Roles(UserRole.COACH) @Delete('availability/:id') deleteSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.deleteSlot(id, actor);
  }
  @Roles(UserRole.COACH) @Get('today-schedule') schedule(
    @CurrentUser() actor: Actor,
  ) {
    return this.service.schedule(actor);
  }
  @Roles(UserRole.COACH) @Get('members') members(
    @CurrentUser() actor: Actor,
    @Query('q') query?: string,
  ) {
    return this.service.members(actor, query);
  }
  @Get(':id/rates') rates(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.rates(id);
  }
  @Roles(UserRole.CENTER_MANAGER) @Post(':id/rates') rate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RateDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.createRate(id, dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Put(':id/rates/:rateId') updateRate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rateId', ParseUUIDPipe) rateId: string,
    @Body() dto: UpdateRateDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.updateRate(id, rateId, dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Delete(':id/rates/:rateId') deleteRate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rateId', ParseUUIDPipe) rateId: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.deleteRate(id, rateId, actor);
  }
}
