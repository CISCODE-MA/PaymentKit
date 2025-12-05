import { createHmac } from 'crypto';
import { StripeWebhookHandler } from '@src/core/gateways/stripe/stripe-webhook.handler';
import type { IncomingWebhookContext } from '@src/core/services/webhook-gateway-router.service';
import type { WebhookEvent } from '@src/common/types/webhook.types';

const SECRET = 'whsec_test_secret';

function buildSignedContext(body: unknown, secret: string = SECRET): IncomingWebhookContext {
  const payload = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  const timestamp = Math.floor(Date.now() / 1000);

  const signedPayload = `${timestamp}.${payload}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(signedPayload, 'utf8');
  const signature = hmac.digest('hex');

  const header = `t=${timestamp},v1=${signature}`;

  return {
    body,
    headers: {
      'Stripe-Signature': header,
    },
  };
}

describe('StripeWebhookHandler', () => {
  it('returns undefined when endpoint secret is null (Stripe disabled)', async () => {
    const handler = new StripeWebhookHandler(null);

    const ctx: IncomingWebhookContext = {
      body: { id: 'evt_1', type: 'payment_intent.succeeded' },
      headers: {},
    };

    const result = await handler.handleWebhook(ctx);

    expect(result).toBeUndefined();
  });

  it('returns undefined when signature is invalid', async () => {
    const handler = new StripeWebhookHandler(SECRET);

    const ctx: IncomingWebhookContext = {
      body: { id: 'evt_2', type: 'payment_intent.succeeded' },
      headers: {
        'Stripe-Signature': 't=12345,v1=bad-signature',
      },
    };

    const result = await handler.handleWebhook(ctx);

    expect(result).toBeUndefined();
  });

  it('returns normalized events when signature is valid', async () => {
    const handler = new StripeWebhookHandler(SECRET);

    const rawStripeEvent = {
      id: 'evt_3',
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

    const ctx = buildSignedContext(rawStripeEvent, SECRET);

    const result = await handler.handleWebhook(ctx);

    expect(Array.isArray(result)).toBe(true);
    const events: WebhookEvent[] = result ?? [];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('payment.succeeded');
    expect(events[0].gateway).toBe('stripe');
    expect(events[0].payload).toEqual(rawStripeEvent.data.object);
  });
});
