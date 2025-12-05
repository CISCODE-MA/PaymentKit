import { verifyStripeWebhook } from '@src/core/gateways/stripe/stripe-webhook-verifier';
import { createHmac } from 'crypto';

describe('verifyStripeWebhook', () => {
  const secret = 'whsec_test_secret';
  const payload = '{"id":"evt_123","type":"payment_intent.succeeded"}';

  const makeHeader = (timestamp: number, signature: string): string =>
    `t=${timestamp},v1=${signature}`;

  const computeSignatureForTest = (timestamp: number): string => {
    const signedPayload = `${timestamp}.${payload}`;
    const hmac = createHmac('sha256', secret);
    hmac.update(signedPayload, 'utf8');
    return hmac.digest('hex');
  };

  it('returns valid=true for a correct signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = computeSignatureForTest(timestamp);

    const header = makeHeader(timestamp, sig);

    const result = verifyStripeWebhook({
      payload,
      signatureHeader: header,
      endpointSecret: secret,
    });

    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns invalid when header is missing', () => {
    const result = verifyStripeWebhook({
      payload,
      signatureHeader: undefined,
      endpointSecret: secret,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('SIGNATURE_HEADER_MISSING');
  });

  it('returns invalid when header cannot be parsed', () => {
    const result = verifyStripeWebhook({
      payload,
      signatureHeader: 'totally-broken',
      endpointSecret: secret,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('SIGNATURE_HEADER_INVALID');
  });

  it('returns invalid when signature does not match', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const badHeader = makeHeader(timestamp, 'bad-signature');

    const result = verifyStripeWebhook({
      payload,
      signatureHeader: badHeader,
      endpointSecret: secret,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('SIGNATURE_MISMATCH');
  });

  it('respects timestamp tolerance when provided', () => {
    const now = Math.floor(Date.now() / 1000);
    const tsTooOld = now - 600; // 10 minutes ago
    const sigOld = computeSignatureForTest(tsTooOld);
    const headerOld = makeHeader(tsTooOld, sigOld);

    const result = verifyStripeWebhook({
      payload,
      signatureHeader: headerOld,
      endpointSecret: secret,
      toleranceSeconds: 300, // 5 minutes
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('TIMESTAMP_OUT_OF_TOLERANCE');
  });
});
