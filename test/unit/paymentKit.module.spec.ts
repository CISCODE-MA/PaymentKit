import { Test } from '@nestjs/testing';
import { PaymentKitModule } from '@src/paymentKit.module';
import { PAYMENTKIT_CONFIG } from '@common/constants';
import type { PaymentKitResolvedConfig } from '@config/paymentKit.config-loader';

describe('PaymentKitModule.register', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    // Minimal valid env for Stripe when enabled
    process.env.PAYMENTKIT_STRIPE_API_KEY = 'sk_test_from_spec';
    process.env.PAYMENTKIT_STRIPE_WEBHOOK_SECRET = 'whsec_from_spec';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('should provide PAYMENTKIT_CONFIG with resolved config', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PaymentKitModule.register({
          environment: 'sandbox',
          defaultCurrency: 'USD',
          gateways: {
            stripe: { enabled: true },
            paypal: { enabled: false },
            adyen: { enabled: false },
          },
        }),
      ],
    }).compile();

    const resolved = moduleRef.get<PaymentKitResolvedConfig>(PAYMENTKIT_CONFIG);

    expect(resolved).toBeDefined();
    expect(resolved.environment).toBe('sandbox');
    expect(resolved.defaultCurrency).toBe('USD');
    expect(resolved.gateways.stripe).toBeDefined();
    expect(resolved.gateways.stripe?.apiKey).toBe('sk_test_from_spec');
  });
});
