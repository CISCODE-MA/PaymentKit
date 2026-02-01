/**
 * Integration Test Setup
 *
 * Configures test environment for integration tests with real gateway sandboxes.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PaymentKitModule } from '@src/paymentKit.module';
import { PaymentsService } from '@src/nest/services/payments.service';

/**
 * Note: For integration tests, set environment variables directly or use a .env.test file
 * loaded by your test runner configuration.
 */

/**
 * Create test module with real gateway configurations
 */
export async function createTestModule(): Promise<TestingModule> {
  const envValue = process.env.PAYMENTKIT_ENVIRONMENT;
  const environment = envValue === 'sandbox' || envValue === 'production' ? envValue : 'sandbox';

  const module = await Test.createTestingModule({
    imports: [
      PaymentKitModule.register({
        environment,
        defaultCurrency: process.env.PAYMENTKIT_DEFAULT_CURRENCY || 'USD',
        gateways: {
          stripe: {
            enabled: process.env.PAYMENTKIT_STRIPE_ENABLED === 'true',
          },
          paypal: {
            enabled: process.env.PAYMENTKIT_PAYPAL_ENABLED === 'true',
          },
        },
        webhooks: {
          mode: 'internal',
        },
      }),
    ],
  }).compile();

  return module;
}

/**
 * Validate test environment configuration
 */
export function validateTestEnvironment(): void {
  const required = [
    'PAYMENTKIT_ENVIRONMENT',
    'PAYMENTKIT_STRIPE_SECRET_KEY',
    'PAYMENTKIT_PAYPAL_CLIENT_ID',
    'PAYMENTKIT_PAYPAL_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for integration tests:\n${missing.join('\n')}\n\n` +
        'Please create .env.test file with test credentials.',
    );
  }

  // Ensure we're in sandbox/test mode
  if (process.env.PAYMENTKIT_ENVIRONMENT === 'production') {
    throw new Error('Cannot run integration tests in production mode!');
  }

  const stripeKey = process.env.PAYMENTKIT_STRIPE_SECRET_KEY || '';
  if (!stripeKey.startsWith('sk_test_')) {
    console.warn('WARNING: Stripe key does not appear to be a test key');
  }
}

/**
 * Helper: Generate unique idempotency key for tests
 */
export function generateIdempotencyKey(prefix = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Helper: Wait for async operations (webhooks, etc.)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test data: Stripe test card numbers
 * @see https://stripe.com/docs/testing
 */
export const STRIPE_TEST_CARDS = {
  SUCCESS: '4242424242424242',
  DECLINED: '4000000000000002',
  INSUFFICIENT_FUNDS: '4000000000009995',
  REQUIRES_AUTH: '4000002500003155',
};

/**
 * Test data: PayPal sandbox account info
 * (Create these in PayPal developer dashboard)
 */
export const PAYPAL_TEST_ACCOUNTS = {
  BUYER_EMAIL: process.env.PAYPAL_TEST_BUYER_EMAIL || 'buyer@example.com',
  SELLER_EMAIL: process.env.PAYPAL_TEST_SELLER_EMAIL || 'seller@example.com',
};

/**
 * Cleanup helper: Delete test payments after test
 * (If gateway supports deletion in test mode)
 */
export function cleanupTestPayment(
  service: PaymentsService,
  gateway: 'stripe' | 'paypal',
  paymentId: string,
): void {
  // Note: Most gateways don't support deletion in test mode
  // Test data automatically expires after 90 days
  console.log(`Test payment created: ${gateway}/${paymentId} (will expire automatically)`);
}
