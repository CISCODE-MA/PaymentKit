import { GatewayKey } from '@src/common/types/gateway.types';
import { Money } from '@src/core/value-objects/money.value-object';
import { Payment } from '@src/core/entities/payment.entity';
import { NormalizedError } from '@src/common/errors/normalized-error.model';
import { PaymentStatus } from '@src/core/entities/payment-status.enum';
import { Refund } from '@src/core/entities/refund.entity';

/**
 * Command to create a payment through a payment gateway.
 *
 * @example
 * ```typescript
 * const command: CreatePaymentCommand = {
 *   gateway: 'stripe',
 *   amount: { currency: 'USD', amount: 1000 }, // $10.00
 *   idempotencyKey: 'order_123_attempt_1',
 *   metadata: { orderId: 'order_123', customerId: 'cust_456' }
 * };
 * ```
 */
export interface CreatePaymentCommand {
  /**
   * The payment gateway to use ('stripe' or 'paypal').
   */
  gateway: GatewayKey;

  /**
   * The amount to charge.
   * Amount should be in minor units (cents for USD, yen for JPY, etc.).
   *
   * @example { currency: 'USD', amount: 1000 } // $10.00
   * @example { currency: 'EUR', amount: 2550 } // €25.50
   */
  amount: Money;

  /**
   * Optional idempotency key to prevent duplicate charges on retries.
   * Must be unique per payment attempt.
   *
   * @example 'order_123_attempt_1'
   */
  idempotencyKey?: string;

  /**
   * Arbitrary metadata to attach to the payment.
   * Will be propagated to the gateway where supported.
   *
   * @example { orderId: 'order_123', customerId: 'cust_456' }
   */
  metadata?: Record<string, unknown>;
}

/**
 * Next action required to complete the payment flow.
 *
 * - `redirect`: User must be redirected to complete payment (PayPal)
 * - `client_secret`: Client-side confirmation needed (Stripe)
 * - `none`: No further action required
 */
export type NextAction =
  | { type: 'redirect'; url: string }
  | { type: 'client_secret'; clientSecret: string }
  | { type: 'none' };

/**
 * Result of a payment creation operation.
 *
 * @example
 * ```typescript
 * const result = await gateway.createPayment(command);
 *
 * if (result.error) {
 *   console.error('Payment failed:', result.error.message);
 *   return;
 * }
 *
 * if (result.nextAction?.type === 'redirect') {
 *   // Redirect user to PayPal
 *   window.location.href = result.nextAction.url;
 * } else if (result.nextAction?.type === 'client_secret') {
 *   // Confirm Stripe payment on client
 *   await stripe.confirmPayment({ clientSecret: result.nextAction.clientSecret });
 * }
 * ```
 */
export interface CreatePaymentResult {
  /**
   * The created payment entity, or null if creation failed.
   */
  payment: Payment | null;

  /**
   * Next action required to complete the payment.
   * Undefined if payment is complete or failed.
   */
  nextAction?: NextAction;

  /**
   * Error details if the operation failed.
   */
  error?: NormalizedError;
}

/**
 * Query to retrieve the current status of a payment.
 * At least one of `paymentId` or `gatewayPaymentId` must be provided.
 *
 * @example
 * ```typescript
 * const query: GetPaymentStatusQuery = {
 *   gateway: 'stripe',
 *   paymentId: 'pay_abc123'
 * };
 * ```
 */
export interface GetPaymentStatusQuery {
  /**
   * The gateway where the payment was processed.
   */
  gateway: GatewayKey;

  /**
   * Internal PaymentKit payment ID.
   */
  paymentId?: string;

  /**
   * Gateway-specific payment ID (e.g., Stripe PaymentIntent ID).
   */
  gatewayPaymentId?: string;
}

/**
 * Result of a payment status query.
 *
 * @example
 * ```typescript
 * const result = await gateway.getPaymentStatus(query);
 *
 * if (result.payment) {
 *   console.log('Payment status:', result.status);
 *   console.log('Amount:', result.payment.amount);
 * }
 * ```
 */
export interface GetPaymentStatusResult {
  /**
   * Current status of the payment.
   */
  status: PaymentStatus | null;

  /**
   * The payment entity with full details, or null if not found.
   */
  payment: Payment | null;

  /**
   * Error details if the operation failed.
   */
  error?: NormalizedError;
}

/**
 * Command to refund a payment (full or partial).
 *
 * @example
 * ```typescript
 * // Full refund
 * const fullRefund: RefundPaymentCommand = {
 *   gateway: 'stripe',
 *   paymentId: 'pay_abc123',
 *   reason: 'Customer requested refund'
 * };
 *
 * // Partial refund
 * const partialRefund: RefundPaymentCommand = {
 *   gateway: 'paypal',
 *   paymentId: 'pay_xyz789',
 *   amount: { currency: 'USD', amount: 500 }, // Refund $5.00
 *   reason: 'Partial order cancellation'
 * };
 * ```
 */
export interface RefundPaymentCommand {
  /**
   * The gateway where the payment was processed.
   */
  gateway: GatewayKey;

  /**
   * The payment ID to refund.
   */
  paymentId: string;

  /**
   * Amount to refund. If omitted, performs a full refund.
   */
  amount?: Money;

  /**
   * Optional reason for the refund.
   * @example 'Customer requested refund'
   */
  reason?: string;

  /**
   * Optional idempotency key to prevent duplicate refunds.
   */
  idempotencyKey?: string;
}

/**
 * Result of a refund operation.
 *
 * @example
 * ```typescript
 * const result = await gateway.refundPayment(command);
 *
 * if (result.refund) {
 *   console.log('Refund successful:', result.refund.id);
 *   console.log('Refund status:', result.refund.status);
 * } else if (result.error) {
 *   console.error('Refund failed:', result.error.message);
 * }
 * ```
 */
export interface RefundPaymentResult {
  /**
   * The created refund entity, or null if refund failed.
   */
  refund: Refund | null;

  /**
   * Error details if the operation failed.
   */
  error?: NormalizedError;
}

/**
 * Core interface that all payment gateway implementations must fulfill.
 *
 * Provides a unified contract for payment operations across different
 * payment providers (Stripe, PayPal, etc.).
 *
 * @example
 * ```typescript
 * export class StripeGateway implements PaymentGateway {
 *   readonly key: GatewayKey = 'stripe';
 *
 *   async createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
 *     // Implementation
 *   }
 *
 *   async getPaymentStatus(query: GetPaymentStatusQuery): Promise<GetPaymentStatusResult> {
 *     // Implementation
 *   }
 *
 *   async refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export interface PaymentGateway {
  /**
   * Unique identifier for this gateway implementation.
   * Used for gateway selection and registration in the gateway registry.
   *
   * @example 'stripe'
   * @example 'paypal'
   */
  readonly key: GatewayKey;

  /**
   * Creates a new payment through this gateway.
   *
   * @param command - Payment creation parameters
   * @returns Promise resolving to payment result with optional next action
   *
   * @example
   * ```typescript
   * const result = await gateway.createPayment({
   *   gateway: 'stripe',
   *   amount: { currency: 'USD', amount: 1000 }
   * });
   * ```
   */
  createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult>;

  /**
   * Retrieves the current status and details of a payment.
   *
   * @param command - Query parameters with payment or gateway payment ID
   * @returns Promise resolving to payment status and details
   *
   * @example
   * ```typescript
   * const result = await gateway.getPaymentStatus({
   *   gateway: 'stripe',
   *   paymentId: 'pay_abc123'
   * });
   * ```
   */
  getPaymentStatus(command: GetPaymentStatusQuery): Promise<GetPaymentStatusResult>;

  /**
   * Refunds a payment (full or partial).
   *
   * @param command - Refund parameters including payment ID and optional amount
   * @returns Promise resolving to refund result
   *
   * @example
   * ```typescript
   * const result = await gateway.refundPayment({
   *   gateway: 'paypal',
   *   paymentId: 'pay_xyz789',
   *   amount: { currency: 'USD', amount: 500 }
   * });
   * ```
   */
  refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult>;
}
