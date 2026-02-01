/**
 * Stripe Payments Integration Tests
 *
 * Tests payment operations against Stripe sandbox API.
 */

import { TestingModule } from '@nestjs/testing';
import { PaymentsService } from '@src/nest/services/payments.service';
import { CreatePaymentCommand } from '@src/core/ports/payment-gateway.port';
import {
  createTestModule,
  validateTestEnvironment,
  generateIdempotencyKey,
  cleanupTestPayment,
} from '../setup';

describe('Stripe Payments Integration', () => {
  let module: TestingModule;
  let paymentsService: PaymentsService;

  beforeAll(async () => {
    validateTestEnvironment();
    module = await createTestModule();
    paymentsService = module.get<PaymentsService>(PaymentsService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      // Arrange
      const command: CreatePaymentCommand = {
        gateway: 'stripe',
        amount: {
          currency: 'USD',
          amount: 1000, // $10.00
        },
        idempotencyKey: generateIdempotencyKey('stripe_create'),
        metadata: {
          test: true,
          description: 'Integration test payment',
        },
      };

      // Act
      const result = await paymentsService.createPayment(command);

      // Assert
      expect(result.error).toBeUndefined();
      expect(result.payment).toBeDefined();
      expect(result.payment?.gateway).toBe('stripe');
      expect(result.payment?.amount.amount).toBe(1000);
      expect(result.payment?.amount.currency).toBe('USD');
      expect(result.nextAction?.type).toBe('client_secret');

      // Cleanup
      if (result.payment) {
        cleanupTestPayment(paymentsService, 'stripe', result.payment.id);
      }
    }, 15000);

    it('should reject invalid amount', async () => {
      // Arrange
      const command: CreatePaymentCommand = {
        gateway: 'stripe',
        amount: {
          currency: 'USD',
          amount: 0, // Invalid amount
        },
        idempotencyKey: generateIdempotencyKey('stripe_invalid'),
      };

      // Act
      const result = await paymentsService.createPayment(command);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.payment).toBeNull();
    }, 10000);

    it('should handle idempotency correctly', async () => {
      // Arrange
      const idempotencyKey = generateIdempotencyKey('stripe_idempotent');
      const command: CreatePaymentCommand = {
        gateway: 'stripe',
        amount: { currency: 'USD', amount: 1500 },
        idempotencyKey,
      };

      // Act
      const result1 = await paymentsService.createPayment(command);
      const result2 = await paymentsService.createPayment(command); // Same key

      // Assert
      expect(result1.payment).toBeDefined();
      expect(result2.payment).toBeDefined();
      expect(result1.payment?.id).toBe(result2.payment?.id); // Same payment

      // Cleanup
      if (result1.payment) {
        cleanupTestPayment(paymentsService, 'stripe', result1.payment.id);
      }
    }, 20000);
  });

  describe('getPaymentStatus', () => {
    let testPaymentId: string;

    beforeAll(async () => {
      // Create a test payment
      const result = await paymentsService.createPayment({
        gateway: 'stripe',
        amount: { currency: 'USD', amount: 2000 },
        idempotencyKey: generateIdempotencyKey('stripe_status_test'),
      });

      testPaymentId = result.payment?.id || '';
    });

    it('should retrieve payment status', async () => {
      // Act
      const result = await paymentsService.getPaymentStatus({
        gateway: 'stripe',
        paymentId: testPaymentId,
      });

      // Assert
      expect(result.error).toBeUndefined();
      expect(result.payment).toBeDefined();
      expect(result.payment?.id).toBe(testPaymentId);
      expect(result.status).toBeDefined();
    }, 10000);

    it('should return error for non-existent payment', async () => {
      // Act
      const result = await paymentsService.getPaymentStatus({
        gateway: 'stripe',
        paymentId: 'pi_nonexistent',
      });

      // Assert
      expect(result.error).toBeDefined();
      expect(result.payment).toBeNull();
    }, 10000);
  });

  describe('currency support', () => {
    it.each([
      { currency: 'USD', amount: 1000 },
      { currency: 'EUR', amount: 1000 },
      { currency: 'GBP', amount: 1000 },
    ])(
      'should support $currency',
      async ({ currency, amount }) => {
        // Arrange
        const command: CreatePaymentCommand = {
          gateway: 'stripe',
          amount: { currency, amount },
          idempotencyKey: generateIdempotencyKey(`stripe_${currency}`),
        };

        // Act
        const result = await paymentsService.createPayment(command);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.payment?.amount.currency).toBe(currency);

        // Cleanup
        if (result.payment) {
          cleanupTestPayment(paymentsService, 'stripe', result.payment.id);
        }
      },
      15000,
    );
  });
});
