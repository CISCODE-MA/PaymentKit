import type { PaypalInternalConfig } from '@config/gateways/paypal.config';
import {
  verifyPaypalWebhook,
  type PaypalWebhookVerificationInput,
} from '@src/core/gateways/paypal/paypal-webhook-verifier';

const makeConfig = (overrides: Partial<PaypalInternalConfig> = {}): PaypalInternalConfig => ({
  clientId: 'client_123',
  clientSecret: 'secret_456',
  webhookId: 'webhook_789',
  ...overrides,
});

const makeInput = (
  overrides: Partial<PaypalWebhookVerificationInput> = {},
): PaypalWebhookVerificationInput => ({
  config: makeConfig(),
  headers: {
    'PayPal-Transmission-Id': 'transmission-id',
    'PayPal-Transmission-Time': '2025-01-01T00:00:00Z',
    'PayPal-Transmission-Sig': 'signature',
    'PayPal-Cert-Url': 'https://api.paypal.com/certs/cert.pem',
    'PayPal-Auth-Algo': 'SHA256withRSA',
  },
  body: { id: 'WH-123' },
  ...overrides,
});

describe('verifyPaypalWebhook', () => {
  it('returns invalid when webhookId is not configured', () => {
    const input = makeInput({
      config: makeConfig({ webhookId: undefined }),
    });

    const result = verifyPaypalWebhook(input);

    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/webhookId is not configured/i);
  });

  it('returns invalid when any required header is missing', () => {
    const headers = {
      'PayPal-Transmission-Id': 'transmission-id',
      'PayPal-Transmission-Time': '2025-01-01T00:00:00Z',
      // Missing PayPal-Transmission-Sig
      'PayPal-Cert-Url': 'https://api.paypal.com/certs/cert.pem',
      'PayPal-Auth-Algo': 'SHA256withRSA',
    };

    const input = makeInput({ headers });

    const result = verifyPaypalWebhook(input);

    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/missing required paypal webhook header/i);
  });

  it('accepts headers regardless of case and array vs string', () => {
    const input = makeInput({
      headers: {
        'paypal-transmission-id': ['transmission-id'],
        'PAYPAL-TRANSMISSION-TIME': '2025-01-01T00:00:00Z',
        'Paypal-Transmission-Sig': 'signature',
        'PAYPAL-CERT-URL': ['https://api.paypal.com/certs/cert.pem'],
        'paypal-auth-algo': 'SHA256withRSA',
      },
    });

    const result = verifyPaypalWebhook(input);

    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns valid when webhookId and all required headers are present', () => {
    const input = makeInput();

    const result = verifyPaypalWebhook(input);

    expect(result.isValid).toBe(true);
  });
});
