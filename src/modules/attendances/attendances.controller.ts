import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Res,
  Param,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { applyPaginationHeaders } from '../../common/dto/pagination.dto';
import { AttendancesService } from './attendances.service';
import {
  GateEntryDto,
  ClassAttendanceDto,
  GateCheckinDto,
  UpdateAttendanceDto,
  AttendanceHistoryQueryDto,
  QrCheckinDto,
  ManualPinCheckinDto,
} from './dto/attendance.dto';
@Controller('attendances')
@ApiTags('Attendances')
@ApiBearerAuth()
export class AttendancesController {
  constructor(private readonly service: AttendancesService) {}

  @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Get('session-qr')
  getSessionQr(@CurrentUser() actor: Actor) {
    return this.service.generateSessionQr(actor);
  }

  @Roles(UserRole.MEMBER, UserRole.COACH)
  @HttpCode(200)
  @Post('qr-checkin')
  qrCheckin(@Body() dto: QrCheckinDto, @CurrentUser() actor: Actor) {
    return this.service.qrCheckin(dto, actor);
  }

  @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @HttpCode(200)
  @Post('manual-checkin')
  manualCheckin(@Body() dto: ManualPinCheckinDto, @CurrentUser() actor: Actor) {
    return this.service.manualPinCheckin(dto, actor);
  }

  @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Get('live-feed')
  getLiveFeed() {
    return this.service.getLiveFeed();
  }
  @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Post('gate-entry')
  gate(@Body() dto: GateEntryDto, @CurrentUser() actor: Actor) {
    return this.service.gate(dto, actor);
  }
  @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @HttpCode(200)
  @Post('gate-checkin')
  async checkin(@Body() dto: GateCheckinDto, @CurrentUser() actor: Actor) {
    const result = await this.service.gate(
      {
        memberId: dto.userId,
        lockerZone: dto.preferredZone,
        towelIssued: dto.towelIssued,
        notes: dto.notes,
      },
      actor,
    );
    return {
      ...result,
      attendanceId: result.attendance.id,
      checkinType: 'GATE_ENTRY',
      assignedLocker: result.lockerAssignment?.locker.lockerNumber ?? null,
      towelIssued: result.attendance.towelIssued,
      checkinTime: result.attendance.checkInTime,
    };
  }
  @Roles(UserRole.COACH) @Post('class-checkin') async create(
    @Body() dto: ClassAttendanceDto,
    @CurrentUser() actor: Actor,
  ) {
    const attendance = await this.service.session(dto, actor, false);
    return { ...attendance, attendanceId: attendance.id };
  }
  @Roles(UserRole.COACH) @Put('class-checkin/:id') correct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.correct(id, dto, actor);
  }
  @Roles(UserRole.COACH) @Post('class-session') session(
    @Body() dto: ClassAttendanceDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.session(dto, actor);
  }
  @Roles(
    UserRole.MEMBER,
    UserRole.COACH,
    UserRole.RECEPTIONIST,
    UserRole.CENTER_MANAGER,
  )
  @Get()
  async history(
    @CurrentUser() actor: Actor,
    @Query() query: AttendanceHistoryQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const targetMemberId = query?.memberId ?? actor.userId;
    const { items, total, page, limit } = await this.service.history(
      targetMemberId,
      actor,
      query,
    );
    applyPaginationHeaders(res, total, page, limit);
    return items;
  }
}
