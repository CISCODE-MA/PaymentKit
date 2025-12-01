import type { PaymentKitPublicConfig } from '@config/paymentKit.config';
import { PaymentKitConfigLoader } from '@config/paymentKit.config-loader';
import { ConfigValidationError } from '@common/errors/config-validation.error';

describe('PaymentKitConfigLoader', () => {
  const baseConfig: PaymentKitPublicConfig = {
    environment: 'sandbox',
    defaultCurrency: 'USD',
    gateways: {
      stripe: { enabled: true },
      paypal: { enabled: false },
      adyen: { enabled: false },
    },
  };

  const makeEnv = (overrides: Record<string, string | undefined> = {}) => ({
    PAYMENTKIT_STRIPE_API_KEY: 'sk_test_123',
    PAYMENTKIT_STRIPE_WEBHOOK_SECRET: 'whsec_456',
    PAYMENTKIT_PAYPAL_CLIENT_ID: 'paypal_client',
    PAYMENTKIT_PAYPAL_CLIENT_SECRET: 'paypal_secret',
    PAYMENTKIT_ADYEN_API_KEY: 'adyen_api',
    PAYMENTKIT_ADYEN_MERCHANT_ACCOUNT: 'adyen_merchant',
    ...overrides,
  });

  it('builds a resolved config when gateways are properly configured', () => {
    const env = makeEnv();

    const resolved = PaymentKitConfigLoader.loadFromEnv(baseConfig, env);

    expect(resolved.environment).toBe('sandbox');
    expect(resolved.defaultCurrency).toBe('USD');

    expect(resolved.gateways.stripe).toBeDefined();
    expect(resolved.gateways.stripe?.apiKey).toBe('sk_test_123');
    expect(resolved.gateways.stripe?.webhookSecret).toBe('whsec_456');

    // disabled gateways should not be present
    expect(resolved.gateways.paypal).toBeUndefined();
    expect(resolved.gateways.adyen).toBeUndefined();

    // default webhook mode should be "internal"
    expect(resolved.webhooks.mode).toBe('internal');
  });

  it('supports enabling multiple gateways at once', () => {
    const config: PaymentKitPublicConfig = {
      ...baseConfig,
      gateways: {
        stripe: { enabled: true },
        paypal: { enabled: true },
        adyen: { enabled: true },
      },
    };

    const env = makeEnv();

    const resolved = PaymentKitConfigLoader.loadFromEnv(config, env);

    expect(resolved.gateways.stripe).toBeDefined();
    expect(resolved.gateways.paypal).toBeDefined();
    expect(resolved.gateways.adyen).toBeDefined();

    expect(resolved.gateways.paypal?.clientId).toBe('paypal_client');
    expect(resolved.gateways.adyen?.merchantAccount).toBe('adyen_merchant');
  });

  it('respects explicit webhooks.mode when provided', () => {
    const config: PaymentKitPublicConfig = {
      ...baseConfig,
      webhooks: {
        mode: 'manual',
      },
    };

    const env = makeEnv();

    const resolved = PaymentKitConfigLoader.loadFromEnv(config, env);

    expect(resolved.webhooks.mode).toBe('manual');
  });

  it('throws ConfigValidationError when global config is invalid', () => {
    const badConfig = {
      // missing environment, defaultCurrency, gateways
    } as unknown as PaymentKitPublicConfig;

    expect(() => PaymentKitConfigLoader.loadFromEnv(badConfig, makeEnv())).toThrow(
      ConfigValidationError,
    );

    try {
      PaymentKitConfigLoader.loadFromEnv(badConfig, makeEnv());
    } catch (err) {
      const e = err as ConfigValidationError;
      expect(e.issues.length).toBeGreaterThan(0);
      const codes = e.issues.map((i) => i.code);
      expect(codes).toContain('ENVIRONMENT_REQUIRED');
      expect(codes).toContain('DEFAULT_CURRENCY_REQUIRED');
      expect(codes).toContain('GATEWAYS_REQUIRED');
    }
  });

  it('throws ConfigValidationError when a gateway is enabled but env is missing', () => {
    const config: PaymentKitPublicConfig = {
      ...baseConfig,
      gateways: {
        stripe: { enabled: true },
        paypal: { enabled: true },
        adyen: { enabled: false },
      },
    };

    const env = makeEnv({
      PAYMENTKIT_STRIPE_API_KEY: '', // invalid
      PAYMENTKIT_PAYPAL_CLIENT_SECRET: '', // invalid
    });

    expect(() => PaymentKitConfigLoader.loadFromEnv(config, env)).toThrow(ConfigValidationError);

    try {
      PaymentKitConfigLoader.loadFromEnv(config, env);
    } catch (err) {
      const e = err as ConfigValidationError;
      const codes = e.issues.map((i) => i.code);

      expect(codes).toContain('STRIPE_API_KEY_REQUIRED');
      expect(codes).toContain('PAYPAL_CLIENT_SECRET_REQUIRED');
    }
  });

  it('does not require env vars for disabled gateways', () => {
    const config: PaymentKitPublicConfig = {
      ...baseConfig,
      gateways: {
        stripe: { enabled: false },
        paypal: { enabled: false },
        adyen: { enabled: false },
      },
    };

    // Intentionally give no env for any gateway
    const env: Record<string, string | undefined> = {};

    const resolved = PaymentKitConfigLoader.loadFromEnv(config, env);

    expect(resolved.gateways.stripe).toBeUndefined();
    expect(resolved.gateways.paypal).toBeUndefined();
    expect(resolved.gateways.adyen).toBeUndefined();

    // Still should have default webhooks.mode
    expect(resolved.webhooks.mode).toBe('internal');
  });
});
