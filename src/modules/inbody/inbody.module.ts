import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseUUIDPipe, Module } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { InbodyService } from './inbody.service';
import { InbodyDto, UpdateInbodyDto } from '../operations/dto/operations.dto';
@Controller('inbody') @ApiTags('InBody') @ApiBearerAuth()
class InbodyController {
 constructor(private readonly service: InbodyService) {}
 @Roles(UserRole.MEMBER, UserRole.COACH, UserRole.CENTER_MANAGER, UserRole.RECEPTIONIST) @Get('my-progress') progress(@CurrentUser() actor: Actor, @Query('memberId') memberId?: string) { return this.service.progress(memberId ?? actor.userId, actor); }
 @Roles(UserRole.RECEPTIONIST, UserRole.COACH, UserRole.CENTER_MANAGER) @Post('logs') create(@Body() dto: InbodyDto, @CurrentUser() actor: Actor) { return this.service.create(dto, actor); }
 @Roles(UserRole.RECEPTIONIST, UserRole.COACH, UserRole.CENTER_MANAGER) @Put('logs/:id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInbodyDto, @CurrentUser() actor: Actor) { return this.service.update(id, dto, actor); }
}
@Module({ controllers: [InbodyController], providers: [InbodyService], exports: [InbodyService] })
export class InbodyModule {}
