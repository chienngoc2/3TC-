import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { LockersService } from './lockers.service';
import { LockerDto, LockerStatusDto } from '../operations/dto/operations.dto';
@Controller('lockers')
@ApiTags('Lockers')
@ApiBearerAuth()
export class LockersController {
  constructor(private readonly service: LockersService) {}
  @Roles(UserRole.CENTER_MANAGER, UserRole.RECEPTIONIST) @Get() list() {
    return this.service.list();
  }
  @Get('my-assignments') mine(@CurrentUser() actor: Actor) {
    return this.service.mine(actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Post() create(
    @Body() dto: LockerDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.create(dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Put(':id/status') status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LockerStatusDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.status(id, dto.status, actor);
  }
  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Put('assignments/:id/return')
  returned(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.return(id, actor);
  }
}
