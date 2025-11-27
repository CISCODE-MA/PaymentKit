import { buildAdyenInternalConfig, type EnvSource } from './adyen.config';

describe('Adyen gateway internal config builder', () => {
  const makeEnv = (overrides: EnvSource = {}): EnvSource => ({
    PAYMENTKIT_ADYEN_API_KEY: 'adyen_api_default',
    PAYMENTKIT_ADYEN_MERCHANT_ACCOUNT: 'adyen_merchant_default',
    ...overrides,
  });

  it('returns null config and no issues when disabled', () => {
    const env = makeEnv();
    const result = buildAdyenInternalConfig(false, env);

    expect(result.config).toBeNull();
    expect(result.issues).toHaveLength(0);
  });

  it('builds a config when enabled and both apiKey and merchantAccount are present', () => {
    const env = makeEnv({
      PAYMENTKIT_ADYEN_API_KEY: 'api_123',
      PAYMENTKIT_ADYEN_MERCHANT_ACCOUNT: 'merchant_456',
    });

    const result = buildAdyenInternalConfig(true, env);

    expect(result.issues).toHaveLength(0);
    expect(result.config).not.toBeNull();
    expect(result.config?.apiKey).toBe('api_123');
    expect(result.config?.merchantAccount).toBe('merchant_456');
  });

  it('trims apiKey and merchantAccount', () => {
    const env = makeEnv({
      PAYMENTKIT_ADYEN_API_KEY: '  api_trim  ',
      PAYMENTKIT_ADYEN_MERCHANT_ACCOUNT: '  merchant_trim  ',
    });

    const result = buildAdyenInternalConfig(true, env);

    expect(result.issues).toHaveLength(0);
    expect(result.config?.apiKey).toBe('api_trim');
    expect(result.config?.merchantAccount).toBe('merchant_trim');
  });

  it('returns an issue when apiKey is missing', () => {
    const env: EnvSource = {
      PAYMENTKIT_ADYEN_API_KEY: '',
      PAYMENTKIT_ADYEN_MERCHANT_ACCOUNT: 'some_merchant',
    };

    const result = buildAdyenInternalConfig(true, env);

    expect(result.config).toBeNull();
    expect(result.issues).toHaveLength(1);
    const [issue] = result.issues;
    expect(issue.code).toBe('ADYEN_API_KEY_REQUIRED');
  });

  it('returns an issue when merchantAccount is missing', () => {
    const env: EnvSource = {
      PAYMENTKIT_ADYEN_API_KEY: 'some_api',
      PAYMENTKIT_ADYEN_MERCHANT_ACCOUNT: '',
    };

    const result = buildAdyenInternalConfig(true, env);

    expect(result.config).toBeNull();
    expect(result.issues).toHaveLength(1);
    const [issue] = result.issues;
    expect(issue.code).toBe('ADYEN_MERCHANT_ACCOUNT_REQUIRED');
  });

  it('prefers apiKey error when both apiKey and merchantAccount are missing', () => {
    const env: EnvSource = {
      PAYMENTKIT_ADYEN_API_KEY: '',
      PAYMENTKIT_ADYEN_MERCHANT_ACCOUNT: '',
    };

    const result = buildAdyenInternalConfig(true, env);

    expect(result.config).toBeNull();
    expect(result.issues).toHaveLength(1);
    const [issue] = result.issues;
    expect(issue.code).toBe('ADYEN_API_KEY_REQUIRED');
  });
});
