import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseUUIDPipe, Module } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { CoachesService } from './coaches.service';
import { SlotDto, RateDto } from '../operations/dto/operations.dto';
@Controller('coaches') @ApiTags('Coaches') @ApiBearerAuth()
class CoachesController {
 constructor(private readonly service: CoachesService) {}
 @Get() list() { return this.service.list(); }
 @Get('availability') slots(@Query('coachId') coachId?: string) { return this.service.slots(coachId); }
 @Roles(UserRole.COACH) @Post('availability') createSlot(@Body() dto: SlotDto, @CurrentUser() actor: Actor) { return this.service.createSlot(dto, actor); }
 @Roles(UserRole.COACH) @Delete('availability/:id') deleteSlot(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Actor) { return this.service.deleteSlot(id, actor); }
 @Roles(UserRole.COACH) @Get('today-schedule') schedule(@CurrentUser() actor: Actor) { return this.service.schedule(actor); }
 @Get(':id/rates') rates(@Param('id', ParseUUIDPipe) id: string) { return this.service.rates(id); }
 @Roles(UserRole.CENTER_MANAGER) @Post(':id/rates') rate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RateDto, @CurrentUser() actor: Actor) { return this.service.createRate(id, dto, actor); }
}
@Module({ controllers: [CoachesController], providers: [CoachesService], exports: [CoachesService] })
export class CoachesModule {}
