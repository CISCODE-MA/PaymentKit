import { normalizePaypalWebhookEvent } from '@core/gateways/paypal/paypal-webhook-normalizer';
import type { PaypalWebhookEnvelope } from '@core/gateways/paypal/paypal-webhook-normalizer';

const baseEnvelope = (overrides: Partial<PaypalWebhookEnvelope> = {}): PaypalWebhookEnvelope => ({
  id: 'WH-123',
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  create_time: '2025-01-01T12:00:00Z',
  resource_type: 'capture',
  resource: { id: 'CAPTURE-1', amount: { value: '10.00', currency_code: 'USD' } },
  summary: 'Payment completed',
  ...overrides,
});

describe('normalizePaypalWebhookEvent', () => {
  it('returns empty array for non-object payloads', () => {
    expect(normalizePaypalWebhookEvent(null)).toEqual([]);
    expect(normalizePaypalWebhookEvent('foo')).toEqual([]);
    expect(normalizePaypalWebhookEvent(123)).toEqual([]);
  });

  it('returns empty array when event_type is missing', () => {
    const env = baseEnvelope({ event_type: undefined });
    expect(normalizePaypalWebhookEvent(env)).toEqual([]);
  });

  it('maps PAYMENT.CAPTURE.COMPLETED to payment.succeeded', () => {
    const env = baseEnvelope({ event_type: 'PAYMENT.CAPTURE.COMPLETED' });

    const events = normalizePaypalWebhookEvent(env);

    expect(events).toHaveLength(1);
    const [event] = events;

    expect(event.type).toBe('payment.succeeded');
    expect(event.gateway).toBe('paypal');
    expect(event.payload).toEqual(env.resource);
    expect(event.raw).toBe(env);
    expect(event.occurredAt instanceof Date).toBe(true);
  });

  it('maps CHECKOUT.ORDER.APPROVED to payment.created', () => {
    const env = baseEnvelope({ event_type: 'CHECKOUT.ORDER.APPROVED' });

    const [event] = normalizePaypalWebhookEvent(env);

    expect(event.type).toBe('payment.created');
  });

  it('maps PAYMENT.CAPTURE.DENIED to payment.failed', () => {
    const env = baseEnvelope({ event_type: 'PAYMENT.CAPTURE.DENIED' });

    const [event] = normalizePaypalWebhookEvent(env);

    expect(event.type).toBe('payment.failed');
  });

  it('maps PAYMENT.CAPTURE.REFUNDED to payment.refunded', () => {
    const env = baseEnvelope({ event_type: 'PAYMENT.CAPTURE.REFUNDED' });

    const [event] = normalizePaypalWebhookEvent(env);

    expect(event.type).toBe('payment.refunded');
  });

  it('maps REFUND.COMPLETED to refund.created', () => {
    const env = baseEnvelope({ event_type: 'REFUND.COMPLETED' });

    const [event] = normalizePaypalWebhookEvent(env);

    expect(event.type).toBe('refund.created');
  });

  it('maps REFUND.DENIED to refund.failed', () => {
    const env = baseEnvelope({ event_type: 'REFUND.DENIED' });

    const [event] = normalizePaypalWebhookEvent(env);

    expect(event.type).toBe('refund.failed');
  });

  it('falls back to original event_type string for unknown events', () => {
    const env = baseEnvelope({ event_type: 'SOME.UNKNOWN.EVENT' });

    const [event] = normalizePaypalWebhookEvent(env);

    expect(event.type).toBe('SOME.UNKNOWN.EVENT');
  });

  it('uses current date when create_time is invalid', () => {
    const env = baseEnvelope({ create_time: 'not-a-date' });

    const [event] = normalizePaypalWebhookEvent(env);

    expect(event.occurredAt instanceof Date).toBe(true);
  });
});
