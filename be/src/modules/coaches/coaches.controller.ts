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
import { CoachesService } from './coaches.service';
import { DateRangeQueryDto } from '../../common/dto/pagination.dto';
import {
  SlotDto,
  SlotQueryDto,
  BulkCreateSlotsDto,
  ApplySlotWorkoutPlanDto,
  RateDto,
  UpdateRateDto,
  ReviewExceptionDto,
  RespondSubstitutionDto,
  ReassignSubstituteDto,
} from '../operations/dto/operations.dto';
@Controller('coaches')
@ApiTags('Coaches')
@ApiBearerAuth()
export class CoachesController {
  constructor(private readonly service: CoachesService) {}

  @Roles(UserRole.CENTER_MANAGER, UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Get('exceptions/pending')
  pendingExceptions() {
    return this.service.listPendingExceptions();
  }

  @Roles(UserRole.CENTER_MANAGER, UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Put('exceptions/:id/review')
  reviewException(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewExceptionDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.reviewException(id, dto, actor);
  }

  @Roles(UserRole.COACH)
  @Get('pickup-schedules')
  pickupSchedules(@CurrentUser() actor: Actor) {
    return this.service.pickupSchedules(actor);
  }

  @Roles(UserRole.COACH)
  @Post('pickup-schedules/:scheduleId/apply')
  applyPickupSchedule(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.applyPickupSchedule(scheduleId, actor);
  }

  @Roles(UserRole.COACH)
  @Get('substitution-requests')
  substitutionRequests(@CurrentUser() actor: Actor) {
    return this.service.substitutionRequests(actor);
  }

  @Roles(UserRole.COACH)
  @Put('substitution-requests/:id/respond')
  respondSubstitutionRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondSubstitutionDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.respondSubstitutionRequest(id, dto, actor);
  }

  @Roles(UserRole.CENTER_MANAGER, UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Get('cancellation-requests/:id/eligible-coaches')
  eligibleSubstitutesForRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eligibleSubstitutesForRequest(id);
  }

  @Roles(UserRole.CENTER_MANAGER, UserRole.ADMIN)
  @Post('cancellation-requests/:id/reassign-substitute')
  reassignSubstitute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignSubstituteDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.reassignSubstitute(id, dto, actor);
  }

  @Roles(UserRole.CENTER_MANAGER, UserRole.ADMIN)
  @Get('payouts/summary')
  payoutSummary(@Query('month') month?: string) {
    return this.service.getPayoutSummary(month);
  }

  @Roles(UserRole.CENTER_MANAGER, UserRole.ADMIN)
  @Get('payouts/:coachId/details')
  payoutDetails(
    @Param('coachId', ParseUUIDPipe) coachId: string,
    @Query('month') month?: string,
  ) {
    return this.service.getPayoutDetails(coachId, month);
  }

  @Roles(UserRole.CENTER_MANAGER, UserRole.ADMIN)
  @Post('payouts/:coachId/pay')
  payCoach(
    @Param('coachId', ParseUUIDPipe) coachId: string,
    @Query('month') month: string,
    @Body('note') note: string,
    @Body('receiptUrl') receiptUrl: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.payCoach(coachId, month, actor, note, receiptUrl);
  }

  @Public() @Get() list() {
    return this.service.list();
  }
  @Public() @Get('availability') slots(@Query() query?: SlotQueryDto) {
    return this.service.slots(query?.coachId, query?.from, query?.to);
  }
  @Roles(UserRole.COACH) @Get('availability/mine') mine(
    @Query() query: DateRangeQueryDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.ownSlots(actor, query?.from, query?.to);
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
  @Roles(UserRole.COACH) @Put('availability/:id/workout-plan') applyWorkoutPlanToSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplySlotWorkoutPlanDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.applyWorkoutPlanToSlot(id, dto, actor);
  }
  @Roles(UserRole.COACH) @Get('today-schedule') schedule(
    @CurrentUser() actor: Actor,
    @Query('date') date?: string,
  ) {
    return this.service.schedule(actor, date);
  }
  @Roles(UserRole.COACH) @Get('members') members(
    @CurrentUser() actor: Actor,
    @Query('q') query?: string,
  ) {
    return this.service.members(actor, query);
  }
  @Roles(UserRole.CENTER_MANAGER, UserRole.ADMIN)
  @Put(':id/rating')
  updateRating(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('ratingStars') ratingStars: number,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.updateRating(id, Number(ratingStars), actor);
  }

  @Public() @Get(':id/rates') rates(@Param('id', ParseUUIDPipe) id: string) {
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

  @Roles(UserRole.COACH)
  @Post('topic-requests')
  createTopicRequest(
    @Body() dto: { specialtyId: string; reason: string; certificateUrl?: string },
    @CurrentUser() actor: Actor,
  ) {
    return this.service.createTopicRequest(dto, actor);
  }

  @Roles(UserRole.COACH, UserRole.CENTER_MANAGER, UserRole.ADMIN)
  @Get('topic-requests')
  listTopicRequests(
    @CurrentUser() actor: Actor,
    @Query('status') status?: string,
  ) {
    return this.service.listTopicRequests(actor, status);
  }

  @Roles(UserRole.CENTER_MANAGER, UserRole.ADMIN)
  @Put('topic-requests/:id/review')
  reviewTopicRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { action: 'APPROVE' | 'REJECT'; rejectionReason?: string },
    @CurrentUser() actor: Actor,
  ) {
    return this.service.reviewTopicRequest(id, dto, actor);
  }
}
