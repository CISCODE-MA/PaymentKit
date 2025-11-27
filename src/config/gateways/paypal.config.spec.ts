import { buildPaypalInternalConfig, type EnvSource } from './paypal.config';

describe('PayPal gateway internal config builder', () => {
  const makeEnv = (overrides: EnvSource = {}): EnvSource => ({
    PAYMENTKIT_PAYPAL_CLIENT_ID: 'paypal_client_default',
    PAYMENTKIT_PAYPAL_CLIENT_SECRET: 'paypal_secret_default',
    ...overrides,
  });

  it('returns null config and no issues when disabled', () => {
    const env = makeEnv();
    const result = buildPaypalInternalConfig(false, env);

    expect(result.config).toBeNull();
    expect(result.issues).toHaveLength(0);
  });

  it('builds a config when enabled and both clientId and clientSecret are present', () => {
    const env = makeEnv({
      PAYMENTKIT_PAYPAL_CLIENT_ID: 'client_123',
      PAYMENTKIT_PAYPAL_CLIENT_SECRET: 'secret_456',
    });

    const result = buildPaypalInternalConfig(true, env);

    expect(result.issues).toHaveLength(0);
    expect(result.config).not.toBeNull();
    expect(result.config?.clientId).toBe('client_123');
    expect(result.config?.clientSecret).toBe('secret_456');
  });

  it('trims clientId and clientSecret', () => {
    const env = makeEnv({
      PAYMENTKIT_PAYPAL_CLIENT_ID: '  client_trim  ',
      PAYMENTKIT_PAYPAL_CLIENT_SECRET: '  secret_trim  ',
    });

    const result = buildPaypalInternalConfig(true, env);

    expect(result.issues).toHaveLength(0);
    expect(result.config?.clientId).toBe('client_trim');
    expect(result.config?.clientSecret).toBe('secret_trim');
  });

  it('returns an issue when clientId is missing', () => {
    const env: EnvSource = {
      PAYMENTKIT_PAYPAL_CLIENT_ID: '',
      PAYMENTKIT_PAYPAL_CLIENT_SECRET: 'some_secret',
    };

    const result = buildPaypalInternalConfig(true, env);

    expect(result.config).toBeNull();
    expect(result.issues).toHaveLength(1);
    const [issue] = result.issues;
    expect(issue.code).toBe('PAYPAL_CLIENT_ID_REQUIRED');
  });

  it('returns an issue when clientSecret is missing', () => {
    const env: EnvSource = {
      PAYMENTKIT_PAYPAL_CLIENT_ID: 'some_client',
      PAYMENTKIT_PAYPAL_CLIENT_SECRET: '',
    };

    const result = buildPaypalInternalConfig(true, env);

    expect(result.config).toBeNull();
    expect(result.issues).toHaveLength(1);
    const [issue] = result.issues;
    expect(issue.code).toBe('PAYPAL_CLIENT_SECRET_REQUIRED');
  });

  it('prefers clientId error when both clientId and clientSecret are missing', () => {
    const env: EnvSource = {
      PAYMENTKIT_PAYPAL_CLIENT_ID: '',
      PAYMENTKIT_PAYPAL_CLIENT_SECRET: '',
    };

    const result = buildPaypalInternalConfig(true, env);

    expect(result.config).toBeNull();
    expect(result.issues).toHaveLength(1);
    const [issue] = result.issues;
    expect(issue.code).toBe('PAYPAL_CLIENT_ID_REQUIRED');
  });
});
