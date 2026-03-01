import type { WebhookEvent } from '@common/types/webhook.types';
import type { PaypalInternalConfig } from '@config/gateways/paypal.config';
import { PaypalWebhookHandler } from '@core/gateways/paypal/paypal-webhook.handler';
import type { IncomingWebhookContext } from '@core/services/webhook-gateway-router.service';

const makeConfig = (overrides: Partial<PaypalInternalConfig> = {}): PaypalInternalConfig => ({
  clientId: 'client_123',
  clientSecret: 'secret_456',
  webhookId: 'webhook_789',
  ...overrides,
});

const makeContext = (overrides: Partial<IncomingWebhookContext> = {}): IncomingWebhookContext => ({
  body: {
    id: 'WH-123',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    create_time: '2025-01-01T12:00:00Z',
    resource: { id: 'CAPTURE-1' },
  },
  headers: {
    'PayPal-Transmission-Id': 'transmission-id',
    'PayPal-Transmission-Time': '2025-01-01T00:00:00Z',
    'PayPal-Transmission-Sig': 'signature',
    'PayPal-Cert-Url': 'https://api.paypal.com/certs/cert.pem',
    'PayPal-Auth-Algo': 'SHA256withRSA',
  },
  ...overrides,
});

describe('PaypalWebhookHandler', () => {
  it('returns undefined when config is null (gateway disabled)', async () => {
    const handler = new PaypalWebhookHandler(null);

    const ctx = makeContext();
    const result = await handler.handleWebhook(ctx);

    expect(result).toBeUndefined();
  });

  it('returns undefined when verification fails (missing headers)', async () => {
    const handler = new PaypalWebhookHandler(makeConfig());

    const ctx = makeContext({
      headers: {
        // missing several required headers
        'PayPal-Transmission-Id': 'transmission-id',
      },
    });

    const result = await handler.handleWebhook(ctx);

    expect(result).toBeUndefined();
  });

  it('returns normalized events when verification passes and payload is valid', async () => {
    const handler = new PaypalWebhookHandler(makeConfig());

    const ctx = makeContext();
    const result = (await handler.handleWebhook(ctx)) as WebhookEvent[];

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);

    const [event] = result;
    expect(event.gateway).toBe('paypal');
    expect(event.type).toBe('payment.succeeded');
    expect(event.payload).toEqual({ id: 'CAPTURE-1' });
    expect(event.raw).toEqual(ctx.body);
  });

  it('returns undefined when normalizer yields no events', async () => {
    const handler = new PaypalWebhookHandler(makeConfig());

    const ctx = makeContext({
      body: {
        // missing event_type
        id: 'WH-123',
      },
    });

    const result = await handler.handleWebhook(ctx);

    expect(result).toBeUndefined();
  });
});
