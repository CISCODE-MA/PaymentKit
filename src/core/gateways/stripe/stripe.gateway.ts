import {
  NormalizedErrorCode,
  type NormalizedError,
} from '@src/common/errors/normalized-error.model';
import type { GatewayKey } from '@src/common/types/gateway.types';
import { PaymentStatus } from '@src/core/entities/payment-status.enum';
import type { Payment } from '@src/core/entities/payment.entity';
import type { Refund } from '@src/core/entities/refund.entity';
import type {
  StripePaymentsClient,
  CreateStripePaymentInput,
  GetStripePaymentStatusInput,
  RefundStripePaymentInput,
} from '@src/core/gateways/stripe/stripe-payments.client';
import type {
  PaymentGateway,
  CreatePaymentCommand,
  CreatePaymentResult,
  GetPaymentStatusQuery,
  GetPaymentStatusResult,
  RefundPaymentCommand,
  RefundPaymentResult,
} from '@src/core/ports/payment-gateway.port';
import type { Money } from '@src/core/value-objects/money.value-object';

const STRIPE_GATEWAY_KEY: GatewayKey = 'stripe';

function mapStripeStatusToPaymentStatus(status: string | undefined): PaymentStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'processing':
      return PaymentStatus.Pending;
    case 'requires_capture':
      return PaymentStatus.Authorized;
    case 'succeeded':
      return PaymentStatus.Captured;
    case 'canceled':
      return PaymentStatus.Canceled;
    default:
      return PaymentStatus.Failed;
  }
}

export class StripeGateway implements PaymentGateway {
  readonly key: GatewayKey = STRIPE_GATEWAY_KEY;

  constructor(private readonly client: StripePaymentsClient) {}

  async createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    const input: CreateStripePaymentInput = {
      amount: command.amount.amount,
      currency: command.amount.currency.toLowerCase(),
      idempotencyKey: command.idempotencyKey,
      metadata: command.metadata,
    };

    const result = await this.client.createPayment(input);

    if (!result.ok) {
      return {
        payment: null,
        error: result.error,
      };
    }

    const now = new Date();

    const payment: Payment = {
      id: result.paymentIntentId,
      gateway: STRIPE_GATEWAY_KEY,
      gatewayPaymentId: result.paymentIntentId,
      amount: command.amount,
      status: mapStripeStatusToPaymentStatus(result.status),
      createdAt: now,
      updatedAt: now,
      metadata: command.metadata,
    };

    const clientSecret =
      typeof result.raw?.client_secret === 'string' ? result.raw.client_secret : undefined;

    return {
      payment,
      nextAction: clientSecret ? { type: 'client_secret', clientSecret } : { type: 'none' },
    };
  }

  async getPaymentStatus(query: GetPaymentStatusQuery): Promise<GetPaymentStatusResult> {
    const paymentIntentId = query.gatewayPaymentId ?? query.paymentId;

    if (!paymentIntentId) {
      const error: NormalizedError = {
        code: NormalizedErrorCode.InvalidRequest,
        message: 'paymentId or gatewayPaymentId is required for Stripe getPaymentStatus',
        gateway: STRIPE_GATEWAY_KEY,
      };

      return {
        status: null,
        payment: null,
        error,
      };
    }

    const input: GetStripePaymentStatusInput = {
      paymentIntentId,
    };

    const result = await this.client.getPaymentStatus(input);

    if (!result.ok) {
      return {
        status: null,
        payment: null,
        error: result.error,
      };
    }

    const status = mapStripeStatusToPaymentStatus(result.status);
    const now = new Date();

    const payment: Payment = {
      id: result.paymentIntentId,
      gateway: STRIPE_GATEWAY_KEY,
      gatewayPaymentId: result.paymentIntentId,
      // We don’t know the original amount here – engine/host
      // can cache it. For now we leave it as a minimal placeholder.
      amount: {
        currency: 'usd',
        amount: 0,
      } as Money,
      status,
      createdAt: now,
      updatedAt: now,
    };

    return {
      status,
      payment,
    };
  }

  async refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult> {
    const input: RefundStripePaymentInput = {
      paymentIntentId: command.paymentId,
      amount: command.amount?.amount,
      idempotencyKey: command.idempotencyKey,
    };

    const result = await this.client.refundPayment(input);

    if (!result.ok) {
      return {
        refund: null,
        error: result.error,
      };
    }

    const now = new Date();

    const refund: Refund = {
      id: result.refundId,
      paymentId: command.paymentId,
      amount: command.amount ?? ({ currency: 'usd', amount: 0 } as Money),
      createdAt: now,
      // Stripe refund does not expose a normalized status that
      // matches our enum yet; we keep it minimal and let engine/host decide.
      status: PaymentStatus.Refunded,
    } as Refund;

    return {
      refund,
    };
  }
}
