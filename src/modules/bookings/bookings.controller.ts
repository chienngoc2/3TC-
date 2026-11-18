import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
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
import {
  PaginationQueryDto,
  applyPaginationHeaders,
} from '../../common/dto/pagination.dto';
import { BookingsService } from './bookings.service';
import {
  GroupBookingDto,
  PtBookingDto,
  CancelDto,
  CancellationRequestDto,
  ReviewDto,
  PenaltyReviewDto,
  BookingListQueryDto,
  CancellationRequestQueryDto,
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
  async list(
    @CurrentUser() actor: Actor,
    @Query() query: BookingListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { items, total, page, limit } = await this.service.list(actor, query);
    applyPaginationHeaders(res, total, page, limit);
    return items;
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
  @Roles(UserRole.RECEPTIONIST)
  @Post('cancellation-requests/on-behalf')
  requestForCoach(
    @Body() dto: CancellationRequestDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.reviewService.request(dto, actor, dto.coachId);
  }
  @Roles(UserRole.COACH, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Get('cancellation-requests')
  async requests(
    @CurrentUser() actor: Actor,
    @Query() query: CancellationRequestQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { items, total, page, limit } = await this.reviewService.list(
      actor,
      query,
    );
    applyPaginationHeaders(res, total, page, limit);
    return items;
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
  @Put([
    'cancellation-requests/:id/cancel',
    'coaches/cancellation-requests/:id/cancel',
  ])
  cancelRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.reviewService.cancel(id, actor);
  }
  @Roles(UserRole.COACH, UserRole.CENTER_MANAGER)
  @Delete(['cancellation-requests/:id', 'coaches/cancellation-requests/:id'])
  deleteRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.reviewService.cancel(id, actor);
  }
  @Roles(UserRole.COACH, UserRole.CENTER_MANAGER)
  @Get('coach-penalties')
  async penalties(
    @CurrentUser() actor: Actor,
    @Query() query: PaginationQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { items, total, page, limit } = await this.reviewService.penalties(
      actor,
      query,
    );
    applyPaginationHeaders(res, total, page, limit);
    return items;
  }
  @Roles(UserRole.CENTER_MANAGER) @Put('coach-penalties/:id/review') penalty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PenaltyReviewDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.reviewService.penalty(id, dto, actor);
  }
}
