/**
 * E-commerce Checkout Example
 *
 * Complete checkout flow with order management, payment creation,
 * and order confirmation.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentsService } from '@ciscode/paymentkit';
import { CreatePaymentCommand, PaymentStatus } from '@ciscode/paymentkit';

// Example domain entities
interface Product {
  id: string;
  name: string;
  price: number; // in cents
  currency: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number; // in cents
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  paymentId?: string;
  gateway?: 'stripe' | 'paypal';
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class EcommerceCheckoutService {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * Complete checkout flow
   */
  async processCheckout(
    userId: string,
    cart: CartItem[],
    gateway: 'stripe' | 'paypal',
  ): Promise<{
    order: Order;
    nextAction?: { type: string; url?: string; clientSecret?: string };
  }> {
    // Step 1: Validate cart
    if (cart.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Step 2: Calculate total
    const total = this.calculateTotal(cart);
    const currency = cart[0].product.currency;

    // Step 3: Create order record
    const order = await this.createOrder(userId, cart, total, currency);

    try {
      // Step 4: Create payment
      const command: CreatePaymentCommand = {
        gateway,
        amount: { currency, amount: total },
        idempotencyKey: `order_${order.id}_payment`,
        metadata: {
          orderId: order.id,
          userId,
          itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
          description: this.generateOrderDescription(cart),
        },
      };

      const result = await this.payments.createPayment(command);

      if (result.error) {
        // Mark order as failed
        await this.updateOrderStatus(order.id, 'failed');
        throw new Error(`Payment failed: ${result.error.message}`);
      }

      // Step 5: Update order with payment info
      await this.updateOrderWithPayment(order.id, result.payment?.id || '', gateway);

      // Step 6: Return order with next action
      return {
        order: {
          ...order,
          paymentId: result.payment?.id,
          gateway,
        },
        nextAction: result.nextAction,
      };
    } catch (error) {
      // Rollback: Mark order as failed
      await this.updateOrderStatus(order.id, 'failed');
      throw error;
    }
  }

  /**
   * Confirm payment after user completes Stripe/PayPal flow
   */
  async confirmPayment(
    orderId: string,
    paymentId: string,
    gateway: 'stripe' | 'paypal',
  ): Promise<Order> {
    // Get payment status from gateway
    const result = await this.payments.getPaymentStatus({
      gateway,
      paymentId,
    });

    if (result.error) {
      throw new Error(`Failed to verify payment: ${result.error.message}`);
    }

    // Check if payment was successful
    if (result.status === PaymentStatus.Captured || result.status === PaymentStatus.Authorized) {
      // Mark order as paid
      const order = await this.updateOrderStatus(orderId, 'paid');

      // Trigger fulfillment process
      await this.triggerFulfillment(order);

      return order;
    } else if (result.status === PaymentStatus.Failed) {
      // Mark order as failed
      return this.updateOrderStatus(orderId, 'failed');
    }

    // Payment still pending
    return this.getOrder(orderId);
  }

  /**
   * Handle payment cancellation
   */
  async cancelCheckout(orderId: string): Promise<Order> {
    const order = await this.getOrder(orderId);

    // Can only cancel pending orders
    if (order.status !== 'pending') {
      throw new BadRequestException(`Cannot cancel order with status: ${order.status}`);
    }

    return this.updateOrderStatus(orderId, 'cancelled');
  }

  /**
   * Process refund for completed order
   */
  async refundOrder(
    orderId: string,
    reason: string,
    partial?: { amount: number },
  ): Promise<{ success: boolean; refundId?: string }> {
    const order = await this.getOrder(orderId);

    if (order.status !== 'paid') {
      throw new BadRequestException('Can only refund paid orders');
    }

    if (!order.paymentId || !order.gateway) {
      throw new BadRequestException('Order has no associated payment');
    }

    // Process refund
    const result = await this.payments.refundPayment({
      gateway: order.gateway,
      paymentId: order.paymentId,
      amount: partial ? { currency: order.currency, amount: partial.amount } : undefined,
      reason,
      idempotencyKey: `refund_${orderId}_${Date.now()}`,
    });

    if (result.error) {
      throw new Error(`Refund failed: ${result.error.message}`);
    }

    // Update order status if full refund
    if (!partial) {
      await this.updateOrderStatus(orderId, 'cancelled');
    }

    return {
      success: true,
      refundId: result.refund?.id,
    };
  }

  // Helper methods (would be implemented with your database)

  private calculateTotal(cart: CartItem[]): number {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }

  private generateOrderDescription(cart: CartItem[]): string {
    return cart.map((item) => `${item.product.name} x${item.quantity}`).join(', ');
  }

  private async createOrder(
    userId: string,
    items: CartItem[],
    total: number,
    currency: string,
  ): Promise<Order> {
    // In real app, save to database
    return {
      id: `order_${Date.now()}`,
      userId,
      items,
      total,
      currency,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async updateOrderWithPayment(
    orderId: string,
    paymentId: string,
    gateway: 'stripe' | 'paypal',
  ): Promise<void> {
    // In real app, update database
    console.log(`Order ${orderId} updated with payment ${paymentId}`);
  }

  private async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order> {
    // In real app, update database
    const order = await this.getOrder(orderId);
    order.status = status;
    order.updatedAt = new Date();
    return order;
  }

  private async getOrder(orderId: string): Promise<Order> {
    // In real app, fetch from database
    throw new Error('Order not found');
  }

  private async triggerFulfillment(order: Order): Promise<void> {
    // Send to warehouse, email customer, etc.
    console.log(`Fulfillment triggered for order ${order.id}`);
  }
}

/**
 * Usage in a controller:
 *
 * @Controller('checkout')
 * export class CheckoutController {
 *   constructor(private readonly checkout: EcommerceCheckoutService) {}
 *
 *   @Post()
 *   async checkout(@Body() dto: CheckoutDto, @Req() req) {
 *     const { cart, gateway } = dto;
 *     const userId = req.user.id;
 *
 *     const result = await this.checkout.processCheckout(userId, cart, gateway);
 *
 *     // Handle next action
 *     if (result.nextAction?.type === 'redirect') {
 *       return {
 *         orderId: result.order.id,
 *         action: 'redirect',
 *         url: result.nextAction.url,
 *       };
 *     } else if (result.nextAction?.type === 'client_secret') {
 *       return {
 *         orderId: result.order.id,
 *         action: 'confirm_stripe',
 *         clientSecret: result.nextAction.clientSecret,
 *       };
 *     }
 *
 *     return { orderId: result.order.id, status: 'completed' };
 *   }
 *
 *   @Post('confirm')
 *   async confirm(@Body() dto: { orderId: string; paymentId: string; gateway: string }) {
 *     return this.checkout.confirmPayment(dto.orderId, dto.paymentId, dto.gateway as any);
 *   }
 *
 *   @Delete(':orderId')
 *   async cancel(@Param('orderId') orderId: string) {
 *     return this.checkout.cancelCheckout(orderId);
 *   }
 *
 *   @Post(':orderId/refund')
 *   async refund(
 *     @Param('orderId') orderId: string,
 *     @Body() dto: { reason: string; partial?: { amount: number } },
 *   ) {
 *     return this.checkout.refundOrder(orderId, dto.reason, dto.partial);
 *   }
 * }
 */
