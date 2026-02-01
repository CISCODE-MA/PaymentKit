/**
 * Webhook Handling Example
 *
 * Demonstrates how to handle payment webhooks from Stripe and PayPal
 * using PaymentKit's built-in webhook system.
 */

import { Injectable, Controller, Post, Req, Res, Headers } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * PaymentKit provides built-in webhook handling when using 'internal' mode.
 *
 * IMPORTANT: PaymentKit automatically:
 * 1. Verifies webhook signatures (HMAC for Stripe, API call for PayPal)
 * 2. Normalizes webhook events to common format
 * 3. Routes events to registered handlers
 *
 * You just need to:
 * - Configure webhook secrets in environment variables
 * - Subscribe to events you care about
 * - Handle business logic
 */

// Event types emitted by PaymentKit
type WebhookEventType =
  | 'payment.created'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.refunded'
  | 'refund.created'
  | 'refund.failed';

interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  gateway: 'stripe' | 'paypal';
  data: {
    paymentId?: string;
    refundId?: string;
    amount?: { currency: string; amount: number };
    status?: string;
    metadata?: Record<string, unknown>;
  };
  createdAt: Date;
}

@Injectable()
export class WebhookHandlerService {
  /**
   * Handle payment success events
   *
   * Called when a payment is successfully completed (captured)
   */
  async handlePaymentSucceeded(event: WebhookEvent): Promise<void> {
    console.log(`Payment succeeded: ${event.data.paymentId}`);

    const { paymentId, metadata } = event.data;

    // Extract order info from metadata
    const orderId = metadata?.orderId as string;

    if (!orderId) {
      console.error('No orderId in payment metadata');
      return;
    }

    try {
      // Update order status in database
      await this.updateOrderStatus(orderId, 'paid');

      // Send confirmation email
      await this.sendConfirmationEmail(orderId);

      // Trigger fulfillment
      await this.triggerFulfillment(orderId);

      // Update analytics
      await this.recordPaymentSuccess(event);

      console.log(`Order ${orderId} marked as paid and fulfillment triggered`);
    } catch (error) {
      console.error('Error handling payment success:', error);
      // Don't throw - webhook will be retried by gateway
    }
  }

  /**
   * Handle payment failure events
   *
   * Called when a payment attempt fails
   */
  async handlePaymentFailed(event: WebhookEvent): Promise<void> {
    console.log(`Payment failed: ${event.data.paymentId}`);

    const { paymentId, metadata } = event.data;
    const orderId = metadata?.orderId as string;

    if (!orderId) {
      return;
    }

    try {
      // Update order status
      await this.updateOrderStatus(orderId, 'payment_failed');

      // Notify customer
      await this.sendPaymentFailureEmail(orderId);

      // Update analytics
      await this.recordPaymentFailure(event);

      console.log(`Order ${orderId} marked as payment failed`);
    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }

  /**
   * Handle refund events
   *
   * Called when a refund is successfully processed
   */
  async handleRefundCreated(event: WebhookEvent): Promise<void> {
    console.log(`Refund created: ${event.data.refundId}`);

    const { paymentId, refundId, amount } = event.data;

    try {
      // Record refund in database
      await this.recordRefund({
        refundId: refundId || '',
        paymentId: paymentId || '',
        amount: amount || { currency: 'USD', amount: 0 },
        gateway: event.gateway,
      });

      // Send refund confirmation email
      await this.sendRefundConfirmationEmail(paymentId || '');

      console.log(`Refund ${refundId} recorded`);
    } catch (error) {
      console.error('Error handling refund:', error);
    }
  }

  /**
   * Handle any webhook event (catch-all)
   */
  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    // Log all events for debugging
    console.log(`Webhook received: ${event.type} from ${event.gateway}`);

    // Route to specific handlers
    switch (event.type) {
      case 'payment.succeeded':
        await this.handlePaymentSucceeded(event);
        break;

      case 'payment.failed':
        await this.handlePaymentFailed(event);
        break;

      case 'payment.refunded':
      case 'refund.created':
        await this.handleRefundCreated(event);
        break;

      case 'payment.created':
        // Payment created but not yet completed
        console.log('Payment created, waiting for completion');
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  // Helper methods (implement with your database/services)

  private async updateOrderStatus(orderId: string, status: string): Promise<void> {
    // Update in database
    console.log(`Updating order ${orderId} to status: ${status}`);
  }

  private async sendConfirmationEmail(orderId: string): Promise<void> {
    // Send email via email service
    console.log(`Sending confirmation email for order ${orderId}`);
  }

  private async sendPaymentFailureEmail(orderId: string): Promise<void> {
    console.log(`Sending payment failure email for order ${orderId}`);
  }

  private async sendRefundConfirmationEmail(paymentId: string): Promise<void> {
    console.log(`Sending refund confirmation email for payment ${paymentId}`);
  }

  private async triggerFulfillment(orderId: string): Promise<void> {
    console.log(`Triggering fulfillment for order ${orderId}`);
  }

  private async recordPaymentSuccess(event: WebhookEvent): Promise<void> {
    // Record in analytics
    console.log('Recording payment success in analytics');
  }

  private async recordPaymentFailure(event: WebhookEvent): Promise<void> {
    console.log('Recording payment failure in analytics');
  }

  private async recordRefund(refund: {
    refundId: string;
    paymentId: string;
    amount: { currency: string; amount: number };
    gateway: string;
  }): Promise<void> {
    console.log(`Recording refund: ${refund.refundId}`);
  }
}

/**
 * Webhook Controller
 *
 * If using 'external' webhook mode, you need to create endpoints manually.
 * With 'internal' mode, PaymentKit provides endpoints automatically.
 */
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly handler: WebhookHandlerService) {}

  /**
   * Stripe webhook endpoint
   *
   * PaymentKit automatically verifies signature and normalizes events
   * when using internal mode.
   */
  @Post('stripe')
  async stripeWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    // With internal mode, PaymentKit handles this automatically
    // This is just an example if you're using external mode

    try {
      // PaymentKit will verify signature and normalize event
      // Then emit it to your event handlers

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({ error: 'Webhook verification failed' });
    }
  }

  /**
   * PayPal webhook endpoint
   */
  @Post('paypal')
  async paypalWebhook(@Req() req: Request, @Res() res: Response) {
    try {
      // PaymentKit verifies PayPal webhook signature via API call

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({ error: 'Webhook verification failed' });
    }
  }
}

/**
 * Environment Variables Required:
 *
 * # Stripe
 * PAYMENTKIT_STRIPE_WEBHOOK_SECRET=whsec_...
 *
 * # PayPal
 * PAYMENTKIT_PAYPAL_WEBHOOK_ID=your-webhook-id
 *
 * # Get webhook secrets:
 * - Stripe: Dashboard > Developers > Webhooks > Add endpoint
 * - PayPal: Developer Dashboard > Webhooks > Create webhook
 */

/**
 * Testing Webhooks Locally:
 *
 * 1. Stripe CLI:
 *    stripe listen --forward-to localhost:3000/webhooks/stripe
 *    stripe trigger payment_intent.succeeded
 *
 * 2. PayPal:
 *    Use ngrok to expose local server:
 *    ngrok http 3000
 *    Add ngrok URL to PayPal webhook settings
 *
 * 3. Manual testing:
 *    POST to your webhook endpoint with sample payload
 */
