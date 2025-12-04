/**
 * Shape of a Paypal webhook event envelope (simplifier).
 * See: https://developer.paypal.com/docs/api/webhooks/#webhooks_event
 */

import { WebhookEvent, WebhookEventType } from '@src/common/types/webhook.types';

export interface PaypalWebhookEnvelope {
  id?: string;
  event_type?: string;
  create_time?: string;
  resource_type?: string;
  resource?: unknown;
  summary?: string;
}

/**
 * Normalize a Paypal webhook envelope into one or more PaymentKit WebhookEvents.
 * For now, we only ever return 0 or 1 event (dev note -- 02/12/2025).
 */

export function normalizePaypalWebhookEvent(raw: unknown): WebhookEvent[] {
  const envelope = raw as PaypalWebhookEnvelope | null;

  if (!envelope || typeof envelope !== 'object') {
    return [];
  }
  const eventType = envelope.event_type;
  if (!eventType || typeof eventType !== 'string') {
    return [];
  }

  const normalizedType = mapPaypalEventTypeToWebhookEventType(eventType);
  const occurredAt = parseOccurredAt(envelope.create_time);

  const event: WebhookEvent = {
    type: normalizedType,
    gateway: 'paypal',
    payload: envelope.resource ?? {},
    occurredAt,
    raw: envelope,
  };
  return [event];
}

function mapPaypalEventTypeToWebhookEventType(eventType: string): WebhookEventType | (string & {}) {
  const key = eventType.toUpperCase();

  // Order / capture related
  if (key === 'CHECKOUT.ORDER.APPROVED' || key === 'PAYMENT.AUTHORIZATION.CREATED') {
    return 'payment.created';
  }

  if (key === 'PAYMENT.CAPTURE.COMPLETED' || key === 'CHECKOUT.ORDER.COMPLETED') {
    return 'payment.succeeded';
  }

  if (key === 'PAYMENT.CAPTURE.DENIED' || key === 'PAYMENT.CAPTURE.REVERSED') {
    return 'payment.failed';
  }

  if (key === 'PAYMENT.CAPTURE.REFUNDED') {
    return 'payment.refunded';
  }

  if (key === 'REFUND.COMPLETED') {
    return 'refund.created';
  }

  if (key === 'REFUND.DENIED' || key === 'REFUND.REVERSED') {
    return 'refund.failed';
  }

  // Fallback: use the original PayPal event_type as-is
  return eventType as string & {};
}

function parseOccurredAt(raw: string | undefined): Date {
  if (!raw) return new Date();

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}
