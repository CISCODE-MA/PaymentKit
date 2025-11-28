import { buildStripeInternalConfig, type EnvSource } from '@config/gateways/stripe.config';

describe(' Stripe gateway internal config builder', () => {
  const makeEnv = (overrides: EnvSource = {}): EnvSource => ({
    PAYMENTKIT_STRIPE_API_KEY: 'sk_test_default',
    PAYMENTKIT_STRIPE_WEBHOOK_SECRET: 'whsec_default',
    ...overrides,
  });

  it('Returns null config and no issues when disabled', () => {
    const env = makeEnv();
    const result = buildStripeInternalConfig(false, env);

    expect(result.config).toBeNull();
    expect(result.issues).toHaveLength(0);
  });

  it('Builds a config when enabled and API key is present', () => {
    const env = makeEnv({
      PAYMENTKIT_STRIPE_API_KEY: 'sk_test_123',
      PAYMENTKIT_STRIPE_WEBHOOK_SECRET: 'whsec_123',
    });

    const result = buildStripeInternalConfig(true, env);

    expect(result.issues).toHaveLength(0);
    expect(result.config).not.toBeNull();

    expect(result.config?.apiKey).toBe('sk_test_123');
    expect(result.config?.webhookSecret).toBe('whsec_123');
  });

  it('trims API key and webhook secret', () => {
    const env = makeEnv({
      PAYMENTKIT_STRIPE_API_KEY: '   sk_test_trim   ',
      PAYMENTKIT_STRIPE_WEBHOOK_SECRET: '  whsec_trim  ',
    });

    const result = buildStripeInternalConfig(true, env);

    expect(result.issues).toHaveLength(0);
    expect(result.config?.apiKey).toBe('sk_test_trim');
    expect(result.config?.webhookSecret).toBe('whsec_trim');
  });

  it('treats missing webhook secret as optional', () => {
    const env: EnvSource = {
      PAYMENTKIT_STRIPE_API_KEY: 'sk_test_no_webhook',
      PAYMENTKIT_STRIPE_WEBHOOK_SECRET: undefined,
    };

    const result = buildStripeInternalConfig(true, env);

    expect(result.issues).toHaveLength(0);
    expect(result.config?.apiKey).toBe('sk_test_no_webhook');
    expect(result.config?.webhookSecret).toBeUndefined();
  });

  it('returns an issue when enabled but API key is missing', () => {
    const env: EnvSource = {
      PAYMENTKIT_STRIPE_API_KEY: '',
      PAYMENTKIT_STRIPE_WEBHOOK_SECRET: 'whsec_ignored',
    };

    const result = buildStripeInternalConfig(true, env);

    expect(result.config).toBeNull();
    expect(result.issues).toHaveLength(1);

    const [issue] = result.issues;
    expect(issue.path).toBe('gateways.stripe');
    expect(issue.code).toBe('STRIPE_API_KEY_REQUIRED');
  });
});
