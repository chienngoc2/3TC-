import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { Actor } from '../../common/types/actor';
import {
  AddonPreviewQueryDto,
  CheckoutListDto,
  CreateCheckoutDto,
} from './checkout.dto';
import { CheckoutService } from './checkout.service';
import {
  MockPaymentLookupDto,
  MockPaymentSimulateDto,
} from './mock-payment.dto';

@Controller()
@ApiTags('Member Checkout')
@ApiBearerAuth()
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  private resolveFrontendOrigin(origin?: string, referer?: string): string | undefined {
    const candidate = origin || referer;
    if (!candidate) return undefined;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Get('billing/quotations/vip')
  vipQuote(
    @Query('planId', ParseUUIDPipe) planId: string,
    @Query('coachId', ParseUUIDPipe) coachId: string,
  ) {
    return this.checkout.vipQuote(planId, coachId);
  }

  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Get('billing/subscriptions/:id/pt-addon-preview')
  addonPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AddonPreviewQueryDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.checkout.addonPreview(id, query.sessions, actor);
  }

  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Post('billing/checkouts')
  create(
    @Body() dto: CreateCheckoutDto,
    @Headers('idempotency-key') key: string,
    @CurrentUser() actor: Actor,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    return this.checkout.create(
      dto,
      key,
      actor,
      this.resolveFrontendOrigin(origin, referer),
    );
  }

  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Get('billing/checkouts')
  list(@Query() query: CheckoutListDto, @CurrentUser() actor: Actor) {
    return this.checkout.list(query, actor);
  }

  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Get('billing/checkouts/:id')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Actor) {
    return this.checkout.detail(id, actor);
  }

  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Post('billing/checkouts/:id/retry')
  retry(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string,
    @CurrentUser() actor: Actor,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    return this.checkout.retry(
      id,
      key,
      actor,
      this.resolveFrontendOrigin(origin, referer),
    );
  }

  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Post('billing/checkouts/:id/reconcile')
  reconcile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.checkout.reconcile(id, actor);
  }

  @Roles(UserRole.MEMBER, UserRole.RECEPTIONIST, UserRole.CENTER_MANAGER)
  @Post('billing/checkouts/:id/mock-pay')
  mockPay(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.checkout.simulateSuccess(id, actor);
  }

  @Public()
  @Post('billing/webhooks/payos')
  payosWebhook(@Body() body: any) {
    return this.checkout.payosWebhook(body);
  }

  @Public()
  @Post('dev/mock-payments/lookup')
  lookup(@Body() dto: MockPaymentLookupDto, @Req() request: Request) {
    return this.checkout.mockLookup(dto.paymentId, request.ip);
  }

  @Public()
  @Post('dev/mock-payments/simulate')
  simulate(@Body() dto: MockPaymentSimulateDto, @Req() request: Request) {
    return this.checkout.simulate(dto.paymentId, dto.outcome, request.ip);
  }

  @Public()
  @Post('billing/webhooks/mock')
  webhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('x-mock-signature') signature?: string,
  ) {
    return this.checkout.mockWebhook(request.rawBody, signature);
  }
}
