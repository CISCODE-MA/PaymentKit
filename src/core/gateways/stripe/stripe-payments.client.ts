import type { NormalizedError } from '@src/common/errors/normalized-error.model';
import { mapStripeErrorToNormalizedError } from '@src/core/gateways/stripe/stripe-error.mapper';
import type { StripeClient, StripeHttpRequest } from '@src/core/gateways/stripe/stripe.client';

interface StripePaymentIntentResponse {
  id: string;
  status?: string;
  [key: string]: unknown;
}

interface StripeRefundResponse {
  id: string;
  status?: string;
  [key: string]: unknown;
}

// ---------- Inputs ----------

export interface CreateStripePaymentInput {
  /**
   * Amount in minor units (e.g. cents).
   */
  amount: number;
  /**
   * ISO 4217 currency code, e.g. "usd".
   */
  currency: string;
  /**
   * Optional idempotency key to avoid duplicate charges.
   */
  idempotencyKey?: string;
  /**
   * Arbitrary metadata propagated to Stripe.
   */
  metadata?: Record<string, unknown>;
}

export interface GetStripePaymentStatusInput {
  paymentIntentId: string;
}

export interface RefundStripePaymentInput {
  /**
   * PaymentIntent id to refund.
   * In a full implementation we may want capture/charge ids as well.
   */
  paymentIntentId: string;
  /**
   * Refund amount in minor units.
   * If omitted, Stripe refunds the full remaining amount.
   */
  amount?: number;
  idempotencyKey?: string;
}

// ---------- Results ----------

export interface StripeErrorResult {
  ok: false;
  error: NormalizedError;
}

export interface CreateStripePaymentSuccess {
  ok: true;
  paymentIntentId: string;
  status: string;
  raw: StripePaymentIntentResponse;
}

export type CreateStripePaymentResult = CreateStripePaymentSuccess | StripeErrorResult;

export interface GetStripePaymentStatusSuccess {
  ok: true;
  paymentIntentId: string;
  status: string;
  raw: StripePaymentIntentResponse;
}

export type GetStripePaymentStatusResult = GetStripePaymentStatusSuccess | StripeErrorResult;

export interface RefundStripePaymentSuccess {
  ok: true;
  refundId: string;
  status: string;
  raw: StripeRefundResponse;
}

export type RefundStripePaymentResult = RefundStripePaymentSuccess | StripeErrorResult;

/**
 * High-level Stripe payments client:
 * uses StripeClient for HTTP + maps non-2xx responses to NormalizedError.
 */
export class StripePaymentsClient {
  constructor(private readonly client: StripeClient) {}

  async createPayment(input: CreateStripePaymentInput): Promise<CreateStripePaymentResult> {
    const request: StripeHttpRequest = {
      method: 'POST',
      path: '/payment_intents',
      idempotencyKey: input.idempotencyKey,
      body: {
        amount: input.amount,
        currency: input.currency,
        metadata: input.metadata,
      },
    };

    const response = await this.client.requestJson<StripePaymentIntentResponse>(request);

    if (response.status >= 200 && response.status < 300) {
      const body = response.body;

      return {
        ok: true,
        paymentIntentId: body.id,
        status: body.status ?? 'unknown',
        raw: body,
      };
    }

    return this.toErrorResult(response.status, response.body);
  }

  async getPaymentStatus(
    input: GetStripePaymentStatusInput,
  ): Promise<GetStripePaymentStatusResult> {
    const request: StripeHttpRequest = {
      method: 'GET',
      path: `/payment_intents/${input.paymentIntentId}`,
    };

    const response = await this.client.requestJson<StripePaymentIntentResponse>(request);

    if (response.status >= 200 && response.status < 300) {
      const body = response.body;

      return {
        ok: true,
        paymentIntentId: body.id,
        status: body.status ?? 'unknown',
        raw: body,
      };
    }

    return this.toErrorResult(response.status, response.body);
  }

  async refundPayment(input: RefundStripePaymentInput): Promise<RefundStripePaymentResult> {
    const request: StripeHttpRequest = {
      method: 'POST',
      path: '/refunds',
      idempotencyKey: input.idempotencyKey,
      body: {
        payment_intent: input.paymentIntentId,
        amount: input.amount,
      },
    };

    const response = await this.client.requestJson<StripeRefundResponse>(request);

    if (response.status >= 200 && response.status < 300) {
      const body = response.body;

      return {
        ok: true,
        refundId: body.id,
        status: body.status ?? 'unknown',
        raw: body,
      };
    }

    return this.toErrorResult(response.status, response.body);
  }

  // ---------- helpers ----------

  private toErrorResult(status: number, body: unknown): StripeErrorResult {
    const error = mapStripeErrorToNormalizedError({
      status,
      body,
    });

    return {
      ok: false,
      error,
    };
  }
}
