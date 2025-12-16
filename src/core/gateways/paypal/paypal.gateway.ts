import {
  type CreatePaymentCommand,
  type CreatePaymentResult,
  type GetPaymentStatusQuery,
  type GetPaymentStatusResult,
  type PaymentGateway,
  type RefundPaymentCommand,
  type RefundPaymentResult,
} from '@src/core/ports/payment-gateway.port';
import { PaymentStatus } from '@src/core/entities/payment-status.enum';
import type { Payment } from '@src/core/entities/payment.entity';
import type { Refund } from '@src/core/entities/refund.entity';
import type { Money } from '@src/core/value-objects/money.value-object';
import {
  NormalizedErrorCode,
  type NormalizedError,
} from '@src/common/errors/normalized-error.model';
import {
  PaypalPaymentsClient,
  type CreatePaypalPaymentInput,
  type GetPaypalPaymentStatusInput,
  type RefundPaypalPaymentInput,
} from '@src/core/gateways/paypal/paypal-payments.client';

/**
 * Concrete PaymentGateway implementation for PayPal.
 *
 * It adapts:
 *   - PaymentKit commands/results
 *   - to/from the internal PaypalPaymentsClient contract.
 */
export class PaypalGateway implements PaymentGateway {
  readonly key = 'paypal' as const;

  constructor(private readonly paymentsClient: PaypalPaymentsClient) {}
  async createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    if (command.gateway !== this.key) {
      return {
        payment: null,
        error: this.buildGatewayMismatchError(command.gateway),
      };
    }

    const paypalInput: CreatePaypalPaymentInput = {
      amount: this.moneyToPaypalAmount(command.amount),
      idempotencyKey: command.idempotencyKey,
      metadata: command.metadata,
    };

    const result = await this.paymentsClient.createPayment(paypalInput);

    if (!result.ok) {
      return {
        payment: null,
        error: result.error,
      };
    }

    const status = this.mapOrderStatusToPaymentStatus(result.status);

    const payment: Payment = {
      // For now we use the PayPal order id as both internal + gateway ids.
      id: result.orderId,
      gateway: this.key,
      gatewayPaymentId: result.orderId,
      amount: command.amount,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: command.metadata,
    } as Payment;

    const approveUrl = this.extractApproveUrl(result.raw);

    return {
      payment,
      nextAction: approveUrl ? { type: 'redirect', url: approveUrl } : { type: 'none' },
    };
  }

  async getPaymentStatus(query: GetPaymentStatusQuery): Promise<GetPaymentStatusResult> {
    if (query.gateway !== this.key) {
      return {
        status: null,
        payment: null,
        error: this.buildGatewayMismatchError(query.gateway),
      };
    }

    const orderId = query.gatewayPaymentId ?? query.paymentId;
    if (!orderId) {
      return {
        status: null,
        payment: null,
        error: {
          code: NormalizedErrorCode.InvalidRequest,
          message: 'Either paymentId or gatewayPaymentId must be provided',
          gateway: this.key,
        },
      };
    }

    const input: GetPaypalPaymentStatusInput = {
      orderId,
    };

    const result = await this.paymentsClient.getPaymentStatus(input);

    if (!result.ok) {
      return {
        status: null,
        payment: null,
        error: result.error,
      };
    }

    const status = this.mapOrderStatusToPaymentStatus(result.status);

    const payment: Payment = {
      id: query.paymentId ?? result.orderId,
      gateway: this.key,
      gatewayPaymentId: result.orderId,
      amount: this.extractAmountFromRaw(result.raw),
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      // No metadata available from status call for now.
    } as Payment;

    return {
      status,
      payment,
    };
  }

  async refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult> {
    if (command.gateway !== this.key) {
      return {
        refund: null,
        error: this.buildGatewayMismatchError(command.gateway),
      };
    }

    const input: RefundPaypalPaymentInput = {
      // We assume paymentId corresponds to the PayPal capture id
      // (the engine is responsible for storing that).
      captureId: command.paymentId,
      amount: command.amount ? this.moneyToPaypalAmount(command.amount) : undefined,
      idempotencyKey: command.idempotencyKey,
    };

    const result = await this.paymentsClient.refundPayment(input);

    if (!result.ok) {
      return {
        refund: null,
        error: result.error,
      };
    }

    const refund: Refund = {
      // We type-assert here because we don't know the full Refund shape yet.
      id: result.refundId,
      gateway: this.key,
      gatewayRefundId: result.refundId,
      paymentId: command.paymentId,
      amount:
        command.amount ??
        ({
          currency: 'UNKNOWN',
          amount: 0,
        } as Money),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Refund;

    return {
      refund,
    };
  }

  // ───────────────────────── HELPERS ─────────────────────────

  private moneyToPaypalAmount(money: Money): { value: string; currencyCode: string } {
    // Amount is in minor units; PayPal expects decimal.
    const value = (money.amount / 100).toFixed(2);
    return {
      value,
      currencyCode: money.currency,
    };
  }

  private mapOrderStatusToPaymentStatus(status: string | undefined): PaymentStatus {
    const normalized = (status ?? '').toUpperCase();

    if (normalized === 'COMPLETED' || normalized === 'CAPTURED') {
      return PaymentStatus.Captured;
    }

    if (
      normalized === 'APPROVED' ||
      normalized === 'CREATED' ||
      normalized === 'PAYER_ACTION_REQUIRED'
    ) {
      return PaymentStatus.Pending;
    }

    if (normalized === 'VOIDED' || normalized === 'CANCELED') {
      return PaymentStatus.Canceled;
    }

    if (normalized === 'FAILED') {
      return PaymentStatus.Failed;
    }

    return PaymentStatus.Pending;
  }

  private buildGatewayMismatchError(actual: string): NormalizedError {
    return {
      code: NormalizedErrorCode.InvalidRequest,
      message: `PaypalGateway received command for gateway "${actual}"`,
      gateway: this.key,
    };
  }

  /**
   * Best-effort extraction of amount from the raw PayPal order for status calls.
   * If we can't find a meaningful amount, we fall back to a zero Money.
   */
  private extractAmountFromRaw(raw: unknown): Money {
    const fallback: Money = {
      currency: 'UNKNOWN',
      amount: 0,
    };

    if (!raw || typeof raw !== 'object') {
      return fallback;
    }

    const anyRaw = raw as {
      purchase_units?: Array<{
        amount?: { value?: string; currency_code?: string };
      }>;
    };

    const unit = anyRaw.purchase_units?.[0];
    const amt = unit?.amount;
    if (!amt || typeof amt.value !== 'string') {
      return fallback;
    }

    const currency = amt.currency_code ?? 'UNKNOWN';
    const numeric = Number.parseFloat(amt.value);
    if (Number.isNaN(numeric)) {
      return fallback;
    }

    return {
      currency,
      amount: Math.round(numeric * 100),
    };
  }

  // ------------ HELPER ------------
  private extractApproveUrl(raw: unknown): string | undefined {
    if (!raw || typeof raw !== 'object') return undefined;

    const links = (raw as { links?: Array<{ href?: unknown; rel?: unknown }> }).links;
    if (!Array.isArray(links)) return undefined;

    const approve = links.find((l) => l?.rel === 'approve' || l?.rel === 'payer-action');

    return typeof approve?.href === 'string' ? approve.href : undefined;
  }
}
