import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { Actor } from '../../common/types/actor';
import { MemberCalendarService } from './member-calendar.service';

class CalendarQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) week: string;
  @IsOptional() @IsUUID() disciplineId?: string;
  @IsOptional() @IsIn(['all', 'group', 'pt', 'mine']) view?:
    'all' | 'group' | 'pt' | 'mine';
}

@Controller('members/me')
@ApiTags('Member Calendar')
@ApiBearerAuth()
export class MemberCalendarController {
  constructor(private readonly service: MemberCalendarService) {}

  @Roles(UserRole.MEMBER)
  @Get('calendar')
  calendar(@Query() query: CalendarQueryDto, @CurrentUser() actor: Actor) {
    return this.service.week(
      query.week,
      actor.userId,
      query.disciplineId,
      query.view ?? 'all',
    );
  }
}
