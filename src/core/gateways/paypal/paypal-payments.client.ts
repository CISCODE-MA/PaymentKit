import { PaypalClient } from './paypal.client';
import { mapPaypalErrorToNormalizedError } from './paypal-error.mapper';
import type { NormalizedError } from '@src/common/errors/normalized-error.model';

export interface CreatePaypalPaymentInput {
  amount: {
    value: string;
    currencyCode: string;
  };
  /**
   * Optional idempotency key – forwarded as PayPal-Request-Id.
   */
  idempotencyKey?: string;
  /**
   * Optional metadata; we store it in custom_id for now.
   */
  metadata?: Record<string, unknown>;
}

export interface CreatePaypalPaymentSuccess {
  ok: true;
  orderId: string;
  status: string;
  raw: unknown;
}

export interface CreatePaypalPaymentFailure {
  ok: false;
  error: NormalizedError;
}

export type CreatePaypalPaymentResult = CreatePaypalPaymentSuccess | CreatePaypalPaymentFailure;

export interface RefundPaypalPaymentInput {
  captureId: string;
  amount?: {
    value: string;
    currencyCode: string;
  };
  idempotencyKey?: string;
}

export interface RefundPaypalPaymentSuccess {
  ok: true;
  refundId: string;
  status: string;
  raw: unknown;
}

export interface RefundPaypalPaymentFailure {
  ok: false;
  error: NormalizedError;
}

export type RefundPaypalPaymentResult = RefundPaypalPaymentSuccess | RefundPaypalPaymentFailure;

interface PaypalOrderResponse {
  id?: string;
  status?: string;
  [key: string]: unknown;
}

interface PaypalRefundResponse {
  id?: string;
  status?: string;
  [key: string]: unknown;
}

interface PaypalErrorLike {
  name?: string;
  message?: string;
  details?: Array<{ issue?: string; description?: string }>;
  [key: string]: unknown;
}

/**
 * Thin payments wrapper on top of PaypalClient.
 * Talks in terms of orders / captures / refunds, but not PaymentKit domain yet.
 */
export class PaypalPaymentsClient {
  constructor(private readonly client: PaypalClient) {}

  async createPayment(input: CreatePaypalPaymentInput): Promise<CreatePaypalPaymentResult> {
    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            value: input.amount.value,
            currency_code: input.amount.currencyCode,
          },
          ...(input.metadata && Object.keys(input.metadata).length > 0
            ? { custom_id: JSON.stringify(input.metadata) }
            : {}),
        },
      ],
    };

    try {
      const response = await this.client.requestJson<PaypalOrderResponse>({
        method: 'POST',
        path: '/v2/checkout/orders',
        body,
        idempotencyKey: input.idempotencyKey,
      });

      if (response.status < 200 || response.status >= 300) {
        const error = mapPaypalErrorToNormalizedError({
          status: response.status,
          body: response.body as PaypalErrorLike,
        });

        return { ok: false, error };
      }

      const orderId = response.body.id ?? '';
      const status = response.body.status ?? 'UNKNOWN';

      if (!orderId) {
        const error = mapPaypalErrorToNormalizedError({
          status: response.status,
          body: {
            name: 'INVALID_RESPONSE',
            message: 'PayPal order response is missing id',
          },
        });

        return { ok: false, error };
      }

      return {
        ok: true,
        orderId,
        status,
        raw: response.body,
      };
    } catch (e) {
      const error = mapPaypalErrorToNormalizedError({
        status: 0,
        body: {
          name: 'NETWORK_ERROR',
          message: e instanceof Error ? e.message : 'Unknown network error',
        },
      });

      return { ok: false, error };
    }
  }

  async refundPayment(input: RefundPaypalPaymentInput): Promise<RefundPaypalPaymentResult> {
    const body =
      input.amount !== undefined
        ? {
            amount: {
              value: input.amount.value,
              currency_code: input.amount.currencyCode,
            },
          }
        : undefined;

    try {
      const response = await this.client.requestJson<PaypalRefundResponse>({
        method: 'POST',
        path: `/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`,
        body,
        idempotencyKey: input.idempotencyKey,
      });

      if (response.status < 200 || response.status >= 300) {
        const error = mapPaypalErrorToNormalizedError({
          status: response.status,
          body: response.body as PaypalErrorLike,
        });

        return { ok: false, error };
      }

      const refundId = response.body.id ?? '';
      const status = response.body.status ?? 'UNKNOWN';

      if (!refundId) {
        const error = mapPaypalErrorToNormalizedError({
          status: response.status,
          body: {
            name: 'INVALID_RESPONSE',
            message: 'PayPal refund response is missing id',
          },
        });

        return { ok: false, error };
      }

      return {
        ok: true,
        refundId,
        status,
        raw: response.body,
      };
    } catch (e) {
      const error = mapPaypalErrorToNormalizedError({
        status: 0,
        body: {
          name: 'NETWORK_ERROR',
          message: e instanceof Error ? e.message : 'Unknown network error',
        },
      });

      return { ok: false, error };
    }
  }
}
