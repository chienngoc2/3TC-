import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Actor } from '../../common/types/actor';
import { applyPaginationHeaders } from '../../common/dto/pagination.dto';
import { InvoiceListQueryDto } from './checkout.dto';
import { BillingService } from './billing.service';
import {
  PurchaseDto,
  RenewDto,
  ApiAddonDto,
  VipPurchaseDto,
} from '../commerce/dto/commerce.dto';
@Controller()
@ApiTags('Billing')
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Post('billing/purchase')
  purchase(@Body() dto: PurchaseDto, @CurrentUser() actor: Actor) {
    return this.service.purchase(dto, actor);
  }
  @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Post('billing/subscriptions/vip')
  vip(@Body() dto: VipPurchaseDto, @CurrentUser() actor: Actor) {
    const { userId, ...rest } = dto;
    return this.service.vip({ ...rest, memberId: userId }, actor);
  }
  @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Post('billing/subscriptions/:id/renew')
  renew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.renew(id, dto, actor);
  }
  @Roles(UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @HttpCode(200)
  @Post('billing/subscriptions/:id/pt-addon')
  async addon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApiAddonDto,
    @CurrentUser() actor: Actor,
  ) {
    const { addonSessions, ...rest } = dto;
    const sold = await this.service.addon(
      id,
      { ...rest, sessions: addonSessions },
      actor,
    );
    return {
      ...sold,
      invoiceId: sold.invoice.id,
      amount: sold.invoice.amount,
      newRemainingPtSessions: sold.subscription.remainingPtSessions,
      invoiceCode: sold.invoice.invoiceCode,
    };
  }
  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Get('billing/invoices')
  async invoices(
    @CurrentUser() actor: Actor,
    @Query() query: InvoiceListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { items, total, page, limit } = await this.service.invoices(actor, query);
    applyPaginationHeaders(res, total, page, limit);
    return items;
  }
}
