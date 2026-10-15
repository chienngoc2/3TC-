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
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PackageTier, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { MembershipsService } from './memberships.service';
import {
  PlanDto,
  UpdatePlanDto,
  SubscriptionStatusDto,
} from '../commerce/dto/commerce.dto';
@Controller()
@ApiTags('Memberships')
@ApiBearerAuth()
export class MembershipsController {
  constructor(private readonly service: MembershipsService) {}

  @Public() @Get('memberships/plans') list(
    @Query('disciplineId', new ParseUUIDPipe({ optional: true }))
    disciplineId?: string,
    @Query('packageTier', new ParseEnumPipe(PackageTier, { optional: true }))
    packageTier?: PackageTier,
  ) {
    return this.service.list(disciplineId, packageTier);
  }
  @Roles(UserRole.CENTER_MANAGER) @Post('memberships/plans') create(
    @Body() dto: PlanDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.create(dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Put('memberships/plans/:id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.update(id, dto, actor);
  }
  @Roles(UserRole.CENTER_MANAGER) @Delete('memberships/plans/:id') disable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.disable(id, actor);
  }
  @Roles(
    UserRole.MEMBER,
    UserRole.COACH,
    UserRole.RECEPTIONIST,
    UserRole.CENTER_MANAGER,
  )
  @Get('memberships/subscriptions')
  subscriptions(
    @CurrentUser() actor: Actor,
    @Query('memberId', new ParseUUIDPipe({ optional: true })) memberId?: string,
  ) {
    return this.service.subscriptions(memberId ?? actor.userId, actor);
  }
  @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Put('memberships/subscriptions/:id/status')
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubscriptionStatusDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.status(id, dto, actor);
  }
}
