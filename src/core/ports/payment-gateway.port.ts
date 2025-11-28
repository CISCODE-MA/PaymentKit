import { GatewayKey } from '@src/common/types/gateway.types';
import { Money } from '../value-objects/money.value-object';
import { Payment } from '../entities/payment.entity';
import { NormalizedError } from '@src/common/errors/normalized-error.model';
import { PaymentStatus } from '../entities/payment-status.enum';
import { Refund } from '../entities/refund.entity';

/**
 * Imput for creating a payment through a gateway
 */
export interface CreatePaymentCommand {
  gateway: GatewayKey;
  amount: Money;
  /**
   * Optional idempotency key to avoid duplicate charges on retries.
   */
  idempotencyKey?: string;
  /**
   * Arbitraty metadata propagated as much as possible to the gateway.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Result of creating a payment through a gateway.
 */
export interface CreatePaymentResult {
  payment: Payment | null;
  error?: NormalizedError;
}

/**
 * Query to retrieve the status of a payment.
 */
export interface GetPaymentStatusQuery {
  gateway: GatewayKey;
  /**
   * Internal PaymentKit payment id.
   */
  paymentId?: string;
  /**
   * Provider-specific payment id.
   * At least one of paymentId/gatewayPaymentId should be provided.
   */
  gatewayPaymentId?: string;
}

/**
 * Result of a getPaymentStatus call.
 */
export interface GetPaymentStatusResult {
  status: PaymentStatus | null;
  payment: Payment | null;
  error?: NormalizedError;
}

/**
 * Input for refunding a payment.
 */
export interface RefundPaymentCommand {
  gateway: GatewayKey;
  paymentId: string;
  /**
   * If omitted, gateway is expected to refund the full remaining amount.
   */
  amount?: Money;
  reason?: string;
  idempotencyKey?: string;
}

/**
 * Result of refunding a payment.
 */
export interface RefundPaymentResult {
  refund: Refund | null;
  error?: NormalizedError;
}

/**
 * Contract all concrete gateway implementations must fulfill.
 * (StripeGateway, PaypalGateway, AdyenGateway, ...)
 */
export interface PaymentGateway {
  /**
   * Unique key identifying this gateway in the registry.
   */
  readonly key: GatewayKey;
  createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult>;
  getPaymentStatus(command: GetPaymentStatusQuery): Promise<GetPaymentStatusResult>;
  refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult>;
  f;
}
