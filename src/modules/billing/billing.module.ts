import { Module } from '@nestjs/common';
import { PayosModule } from '../../infrastructure/payos/payos.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
@Module({
  imports: [PayosModule],
  controllers: [BillingController, CheckoutController],
  providers: [BillingService, CheckoutService],
  exports: [BillingService, CheckoutService],
})
export class BillingModule {}
