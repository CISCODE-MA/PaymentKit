import { GatewayKey } from './gateway.types';

/**
 * Webhook hendling mode for PaymekntKit.
 *
 * - "internal": Webhooks are handled internally by PaymentKit.
 * - "external": Host application consumes normalized events and implements its own side effects.
 */
export type WebhookMode = 'internal' | 'manual';

/**
 * Default mode when none is provided in user configuration.
 */
export const DEFAULT_WEBHOOK_MODE: WebhookMode = 'internal';

/**
 * Canonical normalized webhook event types used inside PaymentKit.
 * These are gateway-agnostic semantic events.
 */
export type WebhookEventType =
  | 'payment.created'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.refunded'
  | 'refund.created'
  | 'refund.failed';

/**
 * Normalized webhook event emitted inside PaymentKit.
 * Payload will usually be a domain snapshot (Payment, Refund, etc.).
 */
export interface WebhookEvent<TPayload = unknown> {
  type: WebhookEventType | (string & {});
  gateway: GatewayKey;
  payload: TPayload;
  occurredAt: Date;
  /**
   * Optional raw provider payload (Stripe, PayPal event object).
   */
  raw?: unknown;
}

/**
 * Listener function for webhook events.
 */
export type WebhookEventListener<TPayload = unknown> = (
  event: WebhookEvent<TPayload>,
) => void | Promise<void>;
