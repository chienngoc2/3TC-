import { WorkoutPlansModule } from './modules/workout-plans/workout-plans.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AttendancesModule } from './modules/attendances/attendances.module';
import { RealtimeModule } from './infrastructure/realtime/realtime.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { BillingModule } from './modules/billing/billing.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { DomainEventsModule } from './common/events/domain-events';
import { ClassesModule } from './modules/classes/classes.module';
import { InbodyModule } from './modules/inbody/inbody.module';
import { LockersModule } from './modules/lockers/lockers.module';
import { StaffShiftsModule } from './modules/staff-shifts/staff-shifts.module';
import { CoachesModule } from './modules/coaches/coaches.module';
import { SpecialtiesModule } from './modules/specialties/specialties.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AppController } from './app.controller';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppService } from './app.service';
import { SystemModule } from './modules/system/system.module';
import { MemberCalendarModule } from './modules/member-calendar/member-calendar.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
    }),
    MembershipsModule,
    MemberCalendarModule,
    BillingModule,
    SchedulesModule,
    WorkoutPlansModule,
    AnalyticsModule,
    AttendancesModule,
    RealtimeModule,
    BookingsModule,
    DomainEventsModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    SystemModule,
    ClassesModule,
    InbodyModule,
    LockersModule,
    StaffShiftsModule,
    CoachesModule,
    SpecialtiesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
