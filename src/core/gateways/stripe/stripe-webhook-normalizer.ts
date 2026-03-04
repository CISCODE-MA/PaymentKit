import type { GatewayKey } from '@src/common/types/gateway.types';
import type { WebhookEvent } from '@src/common/types/webhook.types';

const STRIPE_GATEWAY_KEY: GatewayKey = 'stripe';

interface StripeWebhookEvent {
  id: string;
  type: string;
  created?: number;
  data?: {
    object?: unknown;
  };
  [key: string]: unknown;
}

/**
 * Normalize a raw Stripe Webhook event into one or more PaymentKit Webhook events.
 *
 * For now we emit exactly one event per Stripe webhook and :
 *  - map known payment-related types to generic PaymentKit event types.
 *  - prefix unknonw types with "stripe"
 */
export function normalizeStripeWebhook(raw: unknown): WebhookEvent[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const event = raw as StripeWebhookEvent;
  if (!event.type) {
    return [];
  }
  const occurredAt = event.created ? new Date(event.created * 1000) : new Date();

  const payload = event.data?.object ?? event;

  const mappedType = mapStripeEventType(event.type);

  const normalized: WebhookEvent = {
    type: mappedType,
    gateway: STRIPE_GATEWAY_KEY,
    payload,
    occurredAt,
    raw,
  };

  return [normalized];
}

function mapStripeEventType(stripeType: string): string {
  switch (stripeType) {
    case 'payment_intent.succeeded':
      return 'payment.succeeded';
    case 'payment_intent.payment_failed':
      return 'payment.failed';
    case 'charge.refunded':
      return 'payment.refunded';
    default:
      // Keep it debuggable while still being generic.
      return `stripe.${stripeType}`;
  }
}
