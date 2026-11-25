import { Module } from '@nestjs/common';
import { MemberCalendarController } from './member-calendar.controller';
import { MemberCalendarService } from './member-calendar.service';

@Module({
  controllers: [MemberCalendarController],
  providers: [MemberCalendarService],
})
export class MemberCalendarModule {}
