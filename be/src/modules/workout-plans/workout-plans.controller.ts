import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { applyPaginationHeaders } from '../../common/dto/pagination.dto';
import { WorkoutPlansService } from './workout-plans.service';
import {
  WorkoutDto,
  UpdateWorkoutDto,
  KnowledgeDto,
  AssignTemplateDto,
  WorkoutPlanListQueryDto,
  ExerciseKnowledgeQueryDto,
} from './dto/workout.dto';
@Controller()
@ApiTags('Manual workout plans')
@ApiBearerAuth()
export class WorkoutPlansController {
  constructor(private readonly service: WorkoutPlansService) {}
  @Roles(UserRole.MEMBER, UserRole.COACH, UserRole.CENTER_MANAGER)
  @Get('workout-plans')
  async list(
    @CurrentUser() actor: Actor,
    @Query() query: WorkoutPlanListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { items, total, page, limit } = await this.service.list(actor, query);
    applyPaginationHeaders(res, total, page, limit);
    return items;
  }
  @Roles(UserRole.COACH) @Post('workout-plans') create(
    @Body() dto: WorkoutDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.create(dto, actor);
  }
  @Roles(UserRole.COACH) @Put('workout-plans/:id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkoutDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.update(id, dto, actor);
  }
  @Roles(UserRole.COACH) @Delete('workout-plans/:id') remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.delete(id, actor);
  }
  @Roles(UserRole.MEMBER, UserRole.COACH, UserRole.CENTER_MANAGER)
  @Get('exercise-knowledge')
  async knowledge(
    @Query() query: ExerciseKnowledgeQueryDto,
    @CurrentUser() actor: Actor,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { items, total, page, limit } = await this.service.knowledge(query, actor);
    applyPaginationHeaders(res, total, page, limit);
    return items;
  }
  @Roles(UserRole.CENTER_MANAGER) @Post('exercise-knowledge') createKnowledge(
    @Body() dto: KnowledgeDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.createKnowledge(dto, actor);
  }
  @Roles(UserRole.MEMBER, UserRole.COACH, UserRole.CENTER_MANAGER)
  @Get('workout-templates')
  templates(@Query('discipline') discipline?: string) {
    return this.service.templates(discipline);
  }
  @Roles(UserRole.COACH, UserRole.CENTER_MANAGER)
  @Post('workout-plans/assign-template')
  assignTemplate(@Body() dto: AssignTemplateDto, @CurrentUser() actor: Actor) {
    return this.service.assignTemplate(dto, actor);
  }
  @Roles(UserRole.COACH, UserRole.CENTER_MANAGER)
  @Get('workout-plans/recommendations/:memberId')
  recommendations(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.getRecommendations(memberId, actor);
  }

  @Roles(UserRole.MEMBER, UserRole.COACH, UserRole.CENTER_MANAGER)
  @Get('bookings/:bookingId/workout-plan')
  planByBooking(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.getPlanByBooking(bookingId, actor);
  }

  @Roles(UserRole.COACH, UserRole.CENTER_MANAGER)
  @Put('bookings/:bookingId/workout-plan')
  upsertPlanByBooking(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: any,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.upsertPlanByBooking(bookingId, dto, actor);
  }

  @Roles(UserRole.COACH, UserRole.CENTER_MANAGER)
  @Put('schedules/:scheduleId/workout-plan')
  upsertPlanBySchedule(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: any,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.upsertPlanBySchedule(scheduleId, dto, actor);
  }
}
