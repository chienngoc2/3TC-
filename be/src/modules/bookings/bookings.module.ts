import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CancellationReviewService } from './cancellation-review.service';
import { BookingsController } from './bookings.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BookingsController],
  providers: [BookingsService, CancellationReviewService],
  exports: [BookingsService],
})
export class BookingsModule {}
