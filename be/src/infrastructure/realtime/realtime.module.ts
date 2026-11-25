import { Module } from '@nestjs/common';
import { AuthModule } from '../../modules/auth/auth.module';
import { RealtimeController } from './realtime.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule],
  controllers: [RealtimeController, NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class RealtimeModule {}
