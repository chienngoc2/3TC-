import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { BookingsService } from './bookings.service';
import {
  GroupBookingDto,
  PtBookingDto,
  CancelDto,
  CancellationRequestDto,
  ReviewDto,
  PenaltyReviewDto,
} from '../commerce/dto/commerce.dto';
import { CancellationReviewService } from './cancellation-review.service';
@Controller()
@ApiTags('Bookings')
@ApiBearerAuth()
export class BookingsController {
  constructor(
    private readonly service: BookingsService,
    private readonly reviewService: CancellationReviewService,
  ) {}

  @Roles(
    UserRole.MEMBER,
    UserRole.COACH,
    UserRole.RECEPTIONIST,
    UserRole.CENTER_MANAGER,
  )
  @Get('bookings')
  list(@CurrentUser() actor: Actor) {
    return this.service.list(actor);
  }
  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Post(['bookings/group-class', 'bookings/group'])
  group(@Body() dto: GroupBookingDto, @CurrentUser() actor: Actor) {
    return this.service.group(dto, actor);
  }
  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Post('bookings/pt')
  pt(@Body() dto: PtBookingDto, @CurrentUser() actor: Actor) {
    return this.service.pt(dto, actor);
  }
  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Put('bookings/:id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.cancel(id, dto, actor);
  }
  @Roles(UserRole.COACH)
  @Post(['coaches/cancellation-requests', 'cancellation-requests'])
  request(@Body() dto: CancellationRequestDto, @CurrentUser() actor: Actor) {
    return this.reviewService.request(dto, actor);
  }
  @Roles(UserRole.COACH, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Get('cancellation-requests')
  requests(@CurrentUser() actor: Actor) {
    return this.reviewService.list(actor);
  }
  @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Put('cancellation-requests/:id/review')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.reviewService.review(id, dto, actor);
  }
  @Roles(UserRole.COACH, UserRole.CENTER_MANAGER)
  @Get('coach-penalties')
  penalties(@CurrentUser() actor: Actor) {
    return this.reviewService.penalties(actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Put('coach-penalties/:id/review') penalty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PenaltyReviewDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.reviewService.penalty(id, dto, actor);
  }
}
