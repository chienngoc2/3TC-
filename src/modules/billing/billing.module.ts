import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseUUIDPipe, Module } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { BillingService } from './billing.service';
import { PurchaseDto, RenewDto, AddonDto } from '../commerce/dto/commerce.dto';
@Controller() @ApiTags('Billing') @ApiBearerAuth()
class BillingController {
 constructor(private readonly service: BillingService) {}

 @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER) @Post('billing/purchase') purchase(@Body() dto: PurchaseDto, @CurrentUser() actor: Actor) { return this.service.purchase(dto, actor); }
 @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER) @Post('billing/subscriptions/:id/renew') renew(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RenewDto, @CurrentUser() actor: Actor) { return this.service.renew(id, dto, actor); }
 @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER) @Post('billing/subscriptions/:id/pt-addon') addon(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddonDto, @CurrentUser() actor: Actor) { return this.service.addon(id, dto, actor); }
 @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER) @Get('billing/invoices') invoices(@CurrentUser() actor: Actor) { return this.service.invoices(actor); }

}
@Module({ controllers: [BillingController], providers: [BillingService], exports: [BillingService] })
export class BillingModule {}
