import { Module } from '@nestjs/common';
import { SpecialtiesService } from './specialties.service';
import {
  SpecialtiesController,
  CoachSpecialtiesController,
} from './specialties.controller';
@Module({
  controllers: [SpecialtiesController, CoachSpecialtiesController],
  providers: [SpecialtiesService],
  exports: [SpecialtiesService],
})
export class SpecialtiesModule {}
