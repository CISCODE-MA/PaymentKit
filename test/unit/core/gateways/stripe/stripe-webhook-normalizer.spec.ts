import { normalizeStripeWebhook } from '@src/core/gateways/stripe/stripe-webhook-normalizer';

describe('normalizeStripeWebhook', () => {
  it('maps payment_intent.succeeded to payment.succeeded with data.object payload', () => {
    const raw = {
      id: 'evt_1',
      type: 'payment_intent.succeeded',
      created: 1700000000,
      data: {
        object: {
          id: 'pi_123',
          amount: 1000,
          currency: 'usd',
        },
      },
    };

    const [event] = normalizeStripeWebhook(raw);

    expect(event).toBeDefined();
    expect(event.type).toBe('payment.succeeded');
    expect(event.gateway).toBe('stripe');
    expect(event.payload).toEqual(raw.data.object);
    expect(event.raw).toBe(raw);
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect((event.occurredAt.getTime() / 1000) | 0).toBe(1700000000);
  });

  it('maps payment_intent.payment_failed to payment.failed', () => {
    const raw = {
      id: 'evt_2',
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_456' } },
    };

    const [event] = normalizeStripeWebhook(raw);

    expect(event.type).toBe('payment.failed');
    expect(event.gateway).toBe('stripe');
  });

  it('maps charge.refunded to payment.refunded', () => {
    const raw = {
      id: 'evt_3',
      type: 'charge.refunded',
      data: { object: { id: 'ch_123' } },
    };

    const [event] = normalizeStripeWebhook(raw);

    expect(event.type).toBe('payment.refunded');
    expect(event.gateway).toBe('stripe');
  });

  it('prefixes unknown types with "stripe."', () => {
    const raw = {
      id: 'evt_4',
      type: 'payout.created',
      data: { object: { id: 'po_123' } },
    };

    const [event] = normalizeStripeWebhook(raw);

    expect(event.type).toBe('stripe.payout.created');
  });

  it('returns empty array for non-object or missing type', () => {
    expect(normalizeStripeWebhook(null)).toEqual([]);
    expect(normalizeStripeWebhook('nope')).toEqual([]);
    expect(
      normalizeStripeWebhook({
        id: 'evt_5',
        // no type
      }),
    ).toEqual([]);
  });
});
