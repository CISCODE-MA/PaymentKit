import { createHmac, timingSafeEqual } from 'crypto';

export interface StripeWebhookVerificationInput {
  /**
   * Raw request body as sent by Stripe.
   * MUST be the exact string used to compute the HMAC.
   */
  payload: string;
  /**
   * Value of the "Stripe-Signature" header.
   */
  signatureHeader: string | undefined;
  /**
   * Webhook endpoint secret from your Stripe dashboard.
   */
  endpointSecret: string;
  /**
   * Optional timestamp tolerance in seconds.
   * If provided, verification fails when the timestamp drifts too much.
   */
  toleranceSeconds?: number;
}

export interface StripeWebhookVerificationResult {
  isValid: boolean;
  reason?: string;
}

interface ParsedStripeSignatureHeader {
  timestamp: string;
  signatures: string[];
}

/**
 * Parse a Stripe-Signature header into timestamp + v1 signatures.
 *
 * Example header:
 *   t=1670000000,v1=abc123,v1=def456,v0=zzz
 */
function parseStripeSignatureHeader(header: string): ParsedStripeSignatureHeader | null {
  const parts = header.split(',').map((p) => p.trim());
  let timestamp = '';
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (!key || !value) continue;

    if (key === 't') {
      timestamp = value;
    } else if (key === 'v1') {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

function computeStripeSignature(timestamp: string, payload: string, secret: string): string {
  const signedPayload = `${timestamp}.${payload}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(signedPayload, 'utf8');
  return hmac.digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');

  if (aBuf.length !== bBuf.length) return false;

  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Verify a Stripe webhook.
 * Mirrors the semantics of `verifyPaypalWebhook`.
 */
export function verifyStripeWebhook(
  input: StripeWebhookVerificationInput,
): StripeWebhookVerificationResult {
  const { payload, signatureHeader, endpointSecret, toleranceSeconds } = input;

  if (!signatureHeader) {
    return { isValid: false, reason: 'SIGNATURE_HEADER_MISSING' };
  }

  const parsed = parseStripeSignatureHeader(signatureHeader);

  if (!parsed) {
    return { isValid: false, reason: 'SIGNATURE_HEADER_INVALID' };
  }

  const { timestamp, signatures } = parsed;

  if (toleranceSeconds !== undefined) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tsSeconds = Number(timestamp);

    if (!Number.isFinite(tsSeconds)) {
      return { isValid: false, reason: 'TIMESTAMP_INVALID' };
    }

    const diff = Math.abs(nowSeconds - tsSeconds);
    if (diff > toleranceSeconds) {
      return { isValid: false, reason: 'TIMESTAMP_OUT_OF_TOLERANCE' };
    }
  }

  const expected = computeStripeSignature(timestamp, payload, endpointSecret);

  const match = signatures.some((sig) => safeEqual(sig, expected));

  if (!match) {
    return { isValid: false, reason: 'SIGNATURE_MISMATCH' };
  }

  return { isValid: true };
}
