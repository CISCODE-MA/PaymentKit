import { Injectable } from '@nestjs/common';
import {
  CreatePaymentCommand,
  CreatePaymentResult,
  GetPaymentStatusQuery,
  GetPaymentStatusResult,
  RefundPaymentCommand,
  RefundPaymentResult,
} from '@src/core/ports/payment-gateway.port';
import { DefaultPaymentEngine } from '@src/core/services/payment-engine.service';

/**
 * Main service for payment operations in your NestJS application.
 *
 * This service provides a simple, unified API for managing payments across
 * multiple payment gateways (Stripe, PayPal). It handles gateway selection,
 * error normalization, and payment orchestration.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class OrderService {
 *   constructor(private readonly payments: PaymentsService) {}
 *
 *   async checkout(order: Order) {
 *     const result = await this.payments.createPayment({
 *       gateway: 'stripe',
 *       amount: { currency: 'USD', amount: order.total },
 *       metadata: { orderId: order.id }
 *     });
 *
 *     if (result.error) {
 *       throw new Error(result.error.message);
 *     }
 *
 *     return result.payment;
 *   }
 * }
 * ```
 */
@Injectable()
export class PaymentsService {
  constructor(private readonly engine: DefaultPaymentEngine) {}

  /**
   * Creates a new payment through the specified gateway.
   *
   * @param command - Payment creation parameters
   * @returns Promise resolving to payment result with next action (if applicable)
   *
   * @example
   * ```typescript
   * // Stripe payment
   * const stripeResult = await payments.createPayment({
   *   gateway: 'stripe',
   *   amount: { currency: 'USD', amount: 1000 },
   *   idempotencyKey: 'order_123_attempt_1'
   * });
   *
   * if (stripeResult.nextAction?.type === 'client_secret') {
   *   // Send client secret to frontend for confirmation
   *   return { clientSecret: stripeResult.nextAction.clientSecret };
   * }
   *
   * // PayPal payment
   * const paypalResult = await payments.createPayment({
   *   gateway: 'paypal',
   *   amount: { currency: 'USD', amount: 2500 }
   * });
   *
   * if (paypalResult.nextAction?.type === 'redirect') {
   *   // Redirect user to PayPal
   *   return { redirectUrl: paypalResult.nextAction.url };
   * }
   * ```
   */
  createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    return this.engine.createPayment(command);
  }

  /**
   * Retrieves the current status and details of a payment.
   *
   * @param query - Query parameters with payment or gateway payment ID
   * @returns Promise resolving to payment status and details
   *
   * @example
   * ```typescript
   * const result = await payments.getPaymentStatus({
   *   gateway: 'stripe',
   *   paymentId: 'pay_abc123'
   * });
   *
   * if (result.payment) {
   *   console.log('Status:', result.status);
   *   console.log('Amount:', result.payment.amount);
   * } else if (result.error) {
   *   console.error('Error:', result.error.message);
   * }
   * ```
   */
  getPaymentStatus(query: GetPaymentStatusQuery): Promise<GetPaymentStatusResult> {
    return this.engine.getPaymentStatus(query);
  }

  /**
   * Refunds a payment (full or partial).
   *
   * @param command - Refund parameters including payment ID and optional amount
   * @returns Promise resolving to refund result
   *
   * @example
   * ```typescript
   * // Full refund
   * const fullRefund = await payments.refundPayment({
   *   gateway: 'stripe',
   *   paymentId: 'pay_abc123',
   *   reason: 'Customer requested refund'
   * });
   *
   * // Partial refund
   * const partialRefund = await payments.refundPayment({
   *   gateway: 'paypal',
   *   paymentId: 'pay_xyz789',
   *   amount: { currency: 'USD', amount: 500 }, // Refund $5.00
   *   reason: 'Partial order cancellation',
   *   idempotencyKey: 'refund_order_123_attempt_1'
   * });
   *
   * if (partialRefund.refund) {
   *   console.log('Refund ID:', partialRefund.refund.id);
   *   console.log('Refund status:', partialRefund.refund.status);
   * }
   * ```
   */
  refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult> {
    return this.engine.refundPayment(command);
  }
}
