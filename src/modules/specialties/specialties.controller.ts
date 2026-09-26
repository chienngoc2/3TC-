import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { SpecialtiesService } from './specialties.service';
import {
  SpecialtyDto,
  UpdateSpecialtyDto,
  AssignSpecialtiesDto,
} from '../operations/dto/operations.dto';
@Controller('specialties')
@ApiTags('Specialties')
@ApiBearerAuth()
export class SpecialtiesController {
  constructor(private readonly service: SpecialtiesService) {}
  @Public() @Get() list(
    @Query('disciplineId', new ParseUUIDPipe({ optional: true }))
    disciplineId?: string,
  ) {
    return this.service.list(disciplineId);
  }
  @Roles(UserRole.CENTER_MANAGER) @Post() create(
    @Body() dto: SpecialtyDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.create(dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Put(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecialtyDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.update(id, dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Delete(':id') delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.delete(id, actor);
  }
}
@Controller('coaches')
@ApiTags('Coach specialties')
export class CoachSpecialtiesController {
  constructor(private readonly service: SpecialtiesService) {}
  @Roles(UserRole.CENTER_MANAGER) @Post(':id/specialties') assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSpecialtiesDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.assign(id, dto.specialtyIds, actor);
  }
}
