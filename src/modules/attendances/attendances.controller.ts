import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { AttendancesService } from './attendances.service';
import {
  GateEntryDto,
  ClassAttendanceDto,
  GateCheckinDto,
  UpdateAttendanceDto,
} from './dto/attendance.dto';
@Controller('attendances')
@ApiTags('Attendances')
@ApiBearerAuth()
export class AttendancesController {
  constructor(private readonly service: AttendancesService) {}
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
  history(
    @CurrentUser() actor: Actor,
    @Query('memberId', new ParseUUIDPipe({ optional: true })) memberId?: string,
  ) {
    return this.service.history(memberId ?? actor.userId, actor);
  }
}
