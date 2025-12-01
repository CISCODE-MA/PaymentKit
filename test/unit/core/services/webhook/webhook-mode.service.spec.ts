import { DefaultWebhookModeService } from '@src/core/services/webhook-mode.service';
import type { PaymentKitResolvedConfig } from '@config/paymentKit.config-loader';

describe('DefaultWebhookModeService', () => {
  const makeConfig = (mode: 'internal' | 'manual'): PaymentKitResolvedConfig => ({
    environment: 'sandbox',
    defaultCurrency: 'USD',
    gateways: {
      stripe: undefined,
      paypal: undefined,
      adyen: undefined,
    },
    webhooks: {
      mode,
    },
  });

  it('returns the configured webhook mode', () => {
    const config = makeConfig('manual');
    const service = new DefaultWebhookModeService(config);

    expect(service.getMode()).toBe('manual');
  });

  it('isInternalMode/isManualMode reflect "internal" mode', () => {
    const config = makeConfig('internal');
    const service = new DefaultWebhookModeService(config);

    expect(service.isInternalMode()).toBe(true);
    expect(service.isManualMode()).toBe(false);
  });

  it('isInternalMode/isManualMode reflect "manual" mode', () => {
    const config = makeConfig('manual');
    const service = new DefaultWebhookModeService(config);

    expect(service.isInternalMode()).toBe(false);
    expect(service.isManualMode()).toBe(true);
  });
});
