import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS } from '@payos/node';

export interface PayosCreateLinkResult {
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
  orderCode: number;
  currency: string;
  paymentLinkId: string;
  status: string;
  checkoutUrl: string;
  qrCode: string;
}

export interface PayosWebhookPayload {
  code: string;
  desc: string;
  success: boolean;
  data: {
    orderCode: number;
    amount: number;
    description: string;
    accountNumber: string;
    reference: string;
    transactionDateTime: string;
    currency: string;
    paymentLinkId: string;
    code: string;
    desc: string;
  };
  signature: string;
}

export interface PayosLinkInfo {
  id: string;
  orderCode: number;
  amount: number;
  amountPaid: number;
  amountRemaining: number;
  status: string;
  createdAt: string;
}

@Injectable()
export class PayosService {
  private readonly logger = new Logger(PayosService.name);
  private payosClient: PayOS | null = null;
  private readonly returnUrl: string;
  private readonly cancelUrl: string;

  constructor(private readonly config: ConfigService) {
    const clientId =
      this.config.get<string>('PAYOS_CLIENT_ID') ??
      process.env.PAYOS_CLIENT_ID ??
      '52993569-18b6-4f5d-a09b-66ea4e9b3b47';
    const apiKey =
      this.config.get<string>('PAYOS_API_KEY') ??
      process.env.PAYOS_API_KEY ??
      'a29d04f5-6f51-4118-81eb-19f41cfb017e';
    const checksumKey =
      this.config.get<string>('PAYOS_CHECKSUM_KEY') ??
      process.env.PAYOS_CHECKSUM_KEY ??
      'ff582abfc2ffcbded24408ddf2a42eae045868938187020fe744703c2656cbec';

    this.returnUrl =
      this.config.get<string>('PAYOS_RETURN_URL') ??
      process.env.PAYOS_RETURN_URL ??
      'https://3tcfitness.ddns.net/portal/member/checkout';
    this.cancelUrl =
      this.config.get<string>('PAYOS_CANCEL_URL') ??
      process.env.PAYOS_CANCEL_URL ??
      'https://3tcfitness.ddns.net/portal/member/checkout';

    if (clientId && apiKey && checksumKey) {
      try {
        this.payosClient = new PayOS({
          clientId,
          apiKey,
          checksumKey,
        });
        this.logger.log('PayOS client initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize PayOS client', error);
      }
    } else {
      this.logger.warn('PayOS credentials missing; PayOS integration inactive');
    }
  }

  isConfigured(): boolean {
    return this.payosClient !== null;
  }

  async createPaymentLink(params: {
    orderCode: number;
    amount: number;
    description: string;
    checkoutId: string;
    items?: Array<{ name: string; quantity: number; price: number }>;
  }): Promise<PayosCreateLinkResult | null> {
    if (!this.payosClient) {
      this.logger.warn('PayOS client not configured, cannot create payment link');
      return null;
    }

    try {
      const response = await this.payosClient.paymentRequests.create({
        orderCode: params.orderCode,
        amount: Math.round(params.amount),
        description: params.description.slice(0, 25),
        returnUrl: `${this.returnUrl}/${params.checkoutId}`,
        cancelUrl: `${this.cancelUrl}/${params.checkoutId}`,
        items: params.items,
      });

      return {
        bin: response.bin,
        accountNumber: response.accountNumber,
        accountName: response.accountName,
        amount: response.amount,
        description: response.description,
        orderCode: response.orderCode,
        currency: response.currency,
        paymentLinkId: response.paymentLinkId,
        status: response.status,
        checkoutUrl: response.checkoutUrl,
        qrCode: response.qrCode,
      };
    } catch (error) {
      this.logger.error(`Error creating PayOS payment link for order ${params.orderCode}:`, error);
      throw error;
    }
  }

  async getPaymentLink(orderCode: number): Promise<PayosLinkInfo | null> {
    if (!this.payosClient) return null;
    try {
      const link = await this.payosClient.paymentRequests.get(orderCode);
      return {
        id: link.id,
        orderCode: link.orderCode,
        amount: link.amount,
        amountPaid: link.amountPaid,
        amountRemaining: link.amountRemaining,
        status: link.status,
        createdAt: link.createdAt,
      };
    } catch (error) {
      this.logger.error(`Error fetching PayOS payment link ${orderCode}:`, error);
      return null;
    }
  }

  async cancelPaymentLink(orderCode: number, reason?: string): Promise<boolean> {
    if (!this.payosClient) return false;
    try {
      await this.payosClient.paymentRequests.cancel(orderCode, reason);
      return true;
    } catch (error) {
      this.logger.error(`Error cancelling PayOS payment link ${orderCode}:`, error);
      return false;
    }
  }

  async verifyWebhook(body: PayosWebhookPayload): Promise<PayosWebhookPayload['data'] | null> {
    if (!this.payosClient) return null;
    try {
      const verified = await this.payosClient.webhooks.verify(body as any);
      return verified as PayosWebhookPayload['data'];
    } catch (error) {
      this.logger.error('PayOS webhook verification failed:', error);
      return null;
    }
  }
}
