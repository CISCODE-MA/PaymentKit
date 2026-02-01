/**
 * Basic Payment Flow Example
 *
 * This example demonstrates the fundamental payment creation flow
 * for both Stripe and PayPal gateways.
 */

import { Injectable } from '@nestjs/common';
import { PaymentsService } from '@ciscode/paymentkit';
import { CreatePaymentCommand } from '@ciscode/paymentkit';

@Injectable()
export class BasicPaymentExample {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * Example 1: Create a Stripe payment
   *
   * Stripe uses a two-step flow:
   * 1. Create PaymentIntent on server
   * 2. Confirm payment on client with client_secret
   */
  async createStripePayment() {
    const command: CreatePaymentCommand = {
      gateway: 'stripe',
      amount: {
        currency: 'USD',
        amount: 1000, // $10.00 in cents
      },
      idempotencyKey: `stripe_${Date.now()}`, // Prevent duplicate charges
      metadata: {
        orderId: 'order_123',
        customerId: 'cust_456',
        description: 'Premium subscription',
      },
    };

    const result = await this.payments.createPayment(command);

    // Check for errors
    if (result.error) {
      console.error('Payment failed:', result.error);
      throw new Error(`Payment failed: ${result.error.message}`);
    }

    // Handle next action
    if (result.nextAction?.type === 'client_secret') {
      // Return client secret to frontend for Stripe.js confirmation
      return {
        success: true,
        paymentId: result.payment?.id,
        clientSecret: result.nextAction.clientSecret,
        instructions: 'Use Stripe.js to confirm payment on client side',
      };
    }

    return {
      success: true,
      paymentId: result.payment?.id,
      status: result.payment?.status,
    };
  }

  /**
   * Example 2: Create a PayPal payment
   *
   * PayPal uses a redirect flow:
   * 1. Create Order on server
   * 2. Redirect user to PayPal for approval
   * 3. PayPal redirects back to your site
   * 4. Capture the payment
   */
  async createPaypalPayment() {
    const command: CreatePaymentCommand = {
      gateway: 'paypal',
      amount: {
        currency: 'USD',
        amount: 2500, // $25.00 in cents
      },
      metadata: {
        orderId: 'order_789',
        returnUrl: 'https://yoursite.com/payment/success',
        cancelUrl: 'https://yoursite.com/payment/cancel',
      },
    };

    const result = await this.payments.createPayment(command);

    if (result.error) {
      console.error('Payment failed:', result.error);
      throw new Error(`Payment failed: ${result.error.message}`);
    }

    // PayPal requires redirect
    if (result.nextAction?.type === 'redirect') {
      return {
        success: true,
        paymentId: result.payment?.id,
        redirectUrl: result.nextAction.url,
        instructions: 'Redirect user to PayPal for approval',
      };
    }

    return {
      success: true,
      paymentId: result.payment?.id,
      status: result.payment?.status,
    };
  }

  /**
   * Example 3: Check payment status
   *
   * Useful for polling payment status or after webhook confirmation
   */
  async checkPaymentStatus(gateway: 'stripe' | 'paypal', paymentId: string) {
    const result = await this.payments.getPaymentStatus({
      gateway,
      paymentId,
    });

    if (result.error) {
      console.error('Failed to get payment status:', result.error);
      return { success: false, error: result.error.message };
    }

    return {
      success: true,
      status: result.status,
      payment: {
        id: result.payment?.id,
        amount: result.payment?.amount,
        gateway: result.payment?.gateway,
        createdAt: result.payment?.createdAt,
        metadata: result.payment?.metadata,
      },
    };
  }

  /**
   * Example 4: Dynamic gateway selection
   *
   * Choose gateway based on business logic (currency, region, etc.)
   */
  async createPaymentWithDynamicGateway(
    amount: number,
    currency: string,
    userPreference?: 'stripe' | 'paypal',
  ) {
    // Business logic for gateway selection
    let gateway: 'stripe' | 'paypal' = userPreference || 'stripe';

    // Example: Use PayPal for EUR, Stripe for USD
    if (currency === 'EUR' && !userPreference) {
      gateway = 'paypal';
    }

    const command: CreatePaymentCommand = {
      gateway,
      amount: { currency, amount },
      idempotencyKey: `payment_${Date.now()}_${Math.random()}`,
    };

    const result = await this.payments.createPayment(command);

    if (result.error) {
      // Try fallback gateway on failure
      const fallbackGateway = gateway === 'stripe' ? 'paypal' : 'stripe';
      console.log(`Trying fallback gateway: ${fallbackGateway}`);

      const fallbackCommand: CreatePaymentCommand = {
        ...command,
        gateway: fallbackGateway,
        idempotencyKey: `payment_fallback_${Date.now()}`,
      };

      const fallbackResult = await this.payments.createPayment(fallbackCommand);

      if (fallbackResult.error) {
        throw new Error('Both gateways failed');
      }

      return {
        success: true,
        gateway: fallbackGateway,
        payment: fallbackResult.payment,
        nextAction: fallbackResult.nextAction,
      };
    }

    return {
      success: true,
      gateway,
      payment: result.payment,
      nextAction: result.nextAction,
    };
  }
}

/**
 * Usage in a NestJS controller:
 *
 * @Controller('payments')
 * export class PaymentsController {
 *   constructor(private readonly example: BasicPaymentExample) {}
 *
 *   @Post('stripe')
 *   async createStripe(@Body() body: { amount: number }) {
 *     return this.example.createStripePayment();
 *   }
 *
 *   @Post('paypal')
 *   async createPaypal(@Body() body: { amount: number }) {
 *     return this.example.createPaypalPayment();
 *   }
 *
 *   @Get('status/:gateway/:paymentId')
 *   async checkStatus(
 *     @Param('gateway') gateway: 'stripe' | 'paypal',
 *     @Param('paymentId') paymentId: string,
 *   ) {
 *     return this.example.checkPaymentStatus(gateway, paymentId);
 *   }
 * }
 */
