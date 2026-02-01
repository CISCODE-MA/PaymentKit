import {
  validatePaymentKitPublicConfig,
  type PaymentKitPublicConfig,
} from '@config/paymentKit.config';
import {
  ConfigValidationError,
  parsePaymentKitPublicConfig,
} from '@common/errors/config-validation.error';

describe('PaymentKit global configuration', () => {
  const validConfig: PaymentKitPublicConfig = {
    environment: 'sandbox',
    defaultCurrency: 'USD',
    gateways: {
      stripe: { enabled: true },
      paypal: { enabled: false },
    },
  };

  it('accepts a valid configuration', () => {
    const result = validatePaymentKitPublicConfig(validConfig);

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);

    // parse helper should not throw
    expect(() => parsePaymentKitPublicConfig(validConfig)).not.toThrow();
  });

  it('rejects non-object config', () => {
    const result = validatePaymentKitPublicConfig(null as unknown);

    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe('CONFIG_NOT_OBJECT');
  });

  it('requires a valid environment', () => {
    const bad: unknown = { ...validConfig, environment: 'staging' };

    const result = validatePaymentKitPublicConfig(bad);

    expect(result.valid).toBe(false);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain('ENVIRONMENT_INVALID');
  });

  it('requires a non-empty defaultCurrency', () => {
    const bad = { ...validConfig, defaultCurrency: '' };

    const result = validatePaymentKitPublicConfig(bad);

    expect(result.valid).toBe(false);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain('DEFAULT_CURRENCY_REQUIRED');
  });

  it('requires gateways to be an object', () => {
    const bad: unknown = { ...validConfig, gateways: null };

    const result = validatePaymentKitPublicConfig(bad);

    expect(result.valid).toBe(false);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain('GATEWAYS_NOT_OBJECT');
  });

  it('validates gateway enabled flag as boolean', () => {
    const bad = {
      ...validConfig,
      gateways: {
        ...validConfig.gateways,
        stripe: { enabled: 'yes' },
      },
    };

    const result = validatePaymentKitPublicConfig(bad);

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.path === 'gateways.stripe.enabled');
    expect(issue).toBeDefined();
    expect(issue?.code).toBe('GATEWAY_ENABLED_INVALID');
  });

  it('validates webhooks.mode when provided', () => {
    const withInternal: PaymentKitPublicConfig = {
      ...validConfig,
      webhooks: { mode: 'internal' },
    };

    const internalResult = validatePaymentKitPublicConfig(withInternal);
    expect(internalResult.valid).toBe(true);

    const withManual: PaymentKitPublicConfig = {
      ...validConfig,
      webhooks: { mode: 'manual' },
    };

    const manualResult = validatePaymentKitPublicConfig(withManual);
    expect(manualResult.valid).toBe(true);
  });

  it('rejects invalid webhooks.mode values', () => {
    const bad: unknown = {
      ...validConfig,
      webhooks: { mode: 'invalid-mode' },
    };

    const result = validatePaymentKitPublicConfig(bad);

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.path === 'webhooks.mode');
    expect(issue).toBeDefined();
    expect(issue?.code).toBe('WEBHOOKS_MODE_INVALID');
  });

  it('rejects non-object webhooks', () => {
    const bad: unknown = {
      ...validConfig,
      webhooks: 'manual',
    };

    const result = validatePaymentKitPublicConfig(bad);

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.path === 'webhooks');
    expect(issue).toBeDefined();
    expect(issue?.code).toBe('WEBHOOKS_NOT_OBJECT');
  });

  it('throws ConfigValidationError via parsePaymentKitPublicConfig on invalid config', () => {
    const bad = { ...validConfig, environment: 'invalid' };

    expect(() => parsePaymentKitPublicConfig(bad)).toThrow(ConfigValidationError);

    try {
      parsePaymentKitPublicConfig(bad);
    } catch (err) {
      const e = err as ConfigValidationError;
      expect(e.issues.length).toBeGreaterThan(0);
    }
  });
});
