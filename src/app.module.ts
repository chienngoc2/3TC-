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
import { RedisModule } from './infrastructure/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AppController } from './app.controller';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppService } from './app.service';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
    }),
    PrismaModule,
    RedisModule,
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
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule {}

