/**
 * Refund Operations Example
 *
 * Demonstrates full and partial refund patterns with proper error handling.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentsService } from '@ciscode/paymentkit';
import { RefundPaymentCommand, PaymentStatus } from '@ciscode/paymentkit';

interface RefundRecord {
  id: string;
  paymentId: string;
  amount: { currency: string; amount: number };
  reason: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

@Injectable()
export class RefundOperationsService {
  constructor(private readonly payments: PaymentsService) { }

  /**
   * Example 1: Full refund
   *
   * Refunds the entire payment amount
   */
  async processFullRefund(
    gateway: 'stripe' | 'paypal',
    paymentId: string,
    reason: string,
  ): Promise<RefundRecord> {
    // Step 1: Verify payment exists and is refundable
    const statusResult = await this.payments.getPaymentStatus({
      gateway,
      paymentId,
    });

    if (statusResult.error) {
      throw new BadRequestException(`Cannot verify payment: ${statusResult.error.message}`);
    }

    if (!statusResult.payment) {
      throw new BadRequestException('Payment not found');
    }

    // Step 2: Check payment status (can only refund captured payments)
    if (statusResult.status !== PaymentStatus.Captured) {
      throw new BadRequestException(`Cannot refund payment with status: ${statusResult.status}`);
    }

    // Step 3: Process refund (no amount = full refund)
    const command: RefundPaymentCommand = {
      gateway,
      paymentId,
      reason,
      idempotencyKey: `refund_${paymentId}_${Date.now()}`,
    };

    const result = await this.payments.refundPayment(command);

    if (result.error) {
      throw new Error(`Refund failed: ${result.error.message}`);
    }

    // Step 4: Record refund in database
    const refundRecord: RefundRecord = {
      id: result.refund?.id || '',
      paymentId,
      amount: statusResult.payment.amount,
      reason,
      status: 'completed',
      createdAt: new Date(),
    };

    await this.saveRefundRecord(refundRecord);

    return refundRecord;
  }

  /**
   * Example 2: Partial refund
   *
   * Refunds only a portion of the payment
   */
  async processPartialRefund(
    gateway: 'stripe' | 'paypal',
    paymentId: string,
    refundAmount: number,
    reason: string,
  ): Promise<RefundRecord> {
    // Step 1: Get original payment
    const statusResult = await this.payments.getPaymentStatus({
      gateway,
      paymentId,
    });

    if (!statusResult.payment) {
      throw new BadRequestException('Payment not found');
    }

    // Step 2: Validate refund amount
    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than 0');
    }

    if (refundAmount > statusResult.payment.amount.amount) {
      throw new BadRequestException('Refund amount cannot exceed original payment amount');
    }

    // Step 3: Check if payment was already partially refunded
    const existingRefunds = await this.getRefundsByPayment(paymentId);
    const totalRefunded = existingRefunds.reduce((sum, r) => sum + r.amount.amount, 0);
    const remainingAmount = statusResult.payment.amount.amount - totalRefunded;

    if (refundAmount > remainingAmount) {
      throw new BadRequestException(
        `Cannot refund ${refundAmount}. Only ${remainingAmount} remaining (already refunded ${totalRefunded})`,
      );
    }

    // Step 4: Process partial refund
    const command: RefundPaymentCommand = {
      gateway,
      paymentId,
      amount: {
        currency: statusResult.payment.amount.currency,
        amount: refundAmount,
      },
      reason: `Partial refund: ${reason}`,
      idempotencyKey: `refund_partial_${paymentId}_${Date.now()}`,
    };

    const result = await this.payments.refundPayment(command);

    if (result.error) {
      throw new Error(`Partial refund failed: ${result.error.message}`);
    }

    // Step 5: Record refund
    const refundRecord: RefundRecord = {
      id: result.refund?.id || '',
      paymentId,
      amount: {
        currency: statusResult.payment.amount.currency,
        amount: refundAmount,
      },
      reason: `Partial refund: ${reason}`,
      status: 'completed',
      createdAt: new Date(),
    };

    await this.saveRefundRecord(refundRecord);

    return refundRecord;
  }

  /**
   * Example 3: Refund with validation
   *
   * Checks business rules before processing refund
   */
  async processRefundWithValidation(
    gateway: 'stripe' | 'paypal',
    paymentId: string,
    amount?: number,
    reason?: string,
  ): Promise<RefundRecord> {
    // Get payment details
    const statusResult = await this.payments.getPaymentStatus({
      gateway,
      paymentId,
    });

    if (!statusResult.payment) {
      throw new BadRequestException('Payment not found');
    }

    // Business rule: Cannot refund payments older than 90 days
    const paymentAge = Date.now() - statusResult.payment.createdAt.getTime();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;

    if (paymentAge > ninetyDays) {
      throw new BadRequestException('Cannot refund payments older than 90 days');
    }

    // Business rule: Require reason for refunds over $100
    if (
      (!amount || amount > 10000) && // $100.00
      (!reason || reason.length < 10)
    ) {
      throw new BadRequestException('Detailed reason required for refunds over $100');
    }

    // Business rule: Check refund policy based on metadata
    const orderType = statusResult.payment.metadata?.orderType as string;
    if (orderType === 'non-refundable') {
      throw new BadRequestException('This payment is marked as non-refundable');
    }

    // Process refund
    if (amount) {
      return this.processPartialRefund(gateway, paymentId, amount, reason || 'Refund requested');
    } else {
      return this.processFullRefund(gateway, paymentId, reason || 'Full refund requested');
    }
  }

  /**
   * Example 4: Batch refunds
   *
   * Process multiple refunds at once
   */
  async processBatchRefunds(
    refunds: Array<{
      gateway: 'stripe' | 'paypal';
      paymentId: string;
      amount?: number;
      reason: string;
    }>,
  ): Promise<{
    successful: RefundRecord[];
    failed: Array<{ paymentId: string; error: string }>;
  }> {
    const successful: RefundRecord[] = [];
    const failed: Array<{ paymentId: string; error: string }> = [];

    for (const refund of refunds) {
      try {
        const result = refund.amount
          ? await this.processPartialRefund(
            refund.gateway,
            refund.paymentId,
            refund.amount,
            refund.reason,
          )
          : await this.processFullRefund(refund.gateway, refund.paymentId, refund.reason);

        successful.push(result);

        // Add delay to avoid rate limiting
        await this.sleep(500);
      } catch (error: any) {
        failed.push({
          paymentId: refund.paymentId,
          error: error.message,
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Example 5: Refund with retry
   *
   * Automatically retry failed refunds
   */
  async processRefundWithRetry(
    gateway: 'stripe' | 'paypal',
    paymentId: string,
    amount?: number,
    reason?: string,
    maxRetries = 3,
  ): Promise<RefundRecord> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get payment to determine currency
        const statusResult = await this.payments.getPaymentStatus({
          gateway,
          paymentId,
        });

        if (!statusResult.payment) {
          throw new Error('Payment not found');
        }

        // Build refund command
        const command: RefundPaymentCommand = {
          gateway,
          paymentId,
          amount: amount
            ? {
              currency: statusResult.payment.amount.currency,
              amount,
            }
            : undefined,
          reason: reason || 'Refund',
          idempotencyKey: `refund_${paymentId}_attempt_${attempt}`,
        };

        const result = await this.payments.refundPayment(command);

        if (result.error) {
          lastError = new Error(result.error.message);

          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`Refund attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms`);
          await this.sleep(delay);
          continue;
        }

        // Success
        const refundRecord: RefundRecord = {
          id: result.refund?.id || '',
          paymentId,
          amount: amount
            ? {
              currency: statusResult.payment.amount.currency,
              amount,
            }
            : statusResult.payment.amount,
          reason: reason || 'Refund',
          status: 'completed',
          createdAt: new Date(),
        };

        await this.saveRefundRecord(refundRecord);

        return refundRecord;
      } catch (error: any) {
        lastError = error;

        if (attempt === maxRetries) {
          throw error;
        }

        await this.sleep(1000 * attempt);
      }
    }

    throw lastError || new Error('Refund failed after retries');
  }

  /**
   * Example 6: Check refund status
   */
  async getRefundStatus(
    gateway: 'stripe' | 'paypal',
    paymentId: string,
  ): Promise<{
    totalRefunded: number;
    refunds: RefundRecord[];
    remainingAmount: number;
  }> {
    // Get original payment
    const statusResult = await this.payments.getPaymentStatus({
      gateway,
      paymentId,
    });

    if (!statusResult.payment) {
      throw new BadRequestException('Payment not found');
    }

    // Get all refunds for this payment
    const refunds = await this.getRefundsByPayment(paymentId);

    const totalRefunded = refunds.reduce((sum, r) => sum + r.amount.amount, 0);

    const remainingAmount = statusResult.payment.amount.amount - totalRefunded;

    return {
      totalRefunded,
      refunds,
      remainingAmount,
    };
  }

  // Helper methods (implement with your database)

  private async saveRefundRecord(record: RefundRecord): Promise<void> {
    // Save to database
    console.log('Saving refund record:', record);
  }

  private async getRefundsByPayment(_paymentId: string): Promise<RefundRecord[]> {
    // Fetch from database
    return [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Usage in controller:
 *
 * @Controller('refunds')
 * export class RefundsController {
 *   constructor(private readonly refunds: RefundOperationsService) {}
 *
 *   @Post('full')
 *   async fullRefund(@Body() dto: FullRefundDto) {
 *     return this.refunds.processFullRefund(
 *       dto.gateway,
 *       dto.paymentId,
 *       dto.reason,
 *     );
 *   }
 *
 *   @Post('partial')
 *   async partialRefund(@Body() dto: PartialRefundDto) {
 *     return this.refunds.processPartialRefund(
 *       dto.gateway,
 *       dto.paymentId,
 *       dto.amount,
 *       dto.reason,
 *     );
 *   }
 *
 *   @Post('batch')
 *   async batchRefund(@Body() dto: { refunds: any[] }) {
 *     return this.refunds.processBatchRefunds(dto.refunds);
 *   }
 *
 *   @Get(':gateway/:paymentId')
 *   async getStatus(
 *     @Param('gateway') gateway: 'stripe' | 'paypal',
 *     @Param('paymentId') paymentId: string,
 *   ) {
 *     return this.refunds.getRefundStatus(gateway, paymentId);
 *   }
 * }
 */

/**
 * Important Notes:
 *
 * 1. Refund timing:
 *    - Stripe: 5-10 business days to customer
 *    - PayPal: 3-5 business days to customer
 *
 * 2. Partial refunds:
 *    - Can refund any amount up to original payment
 *    - Can issue multiple partial refunds
 *    - Total refunds cannot exceed original amount
 *
 * 3. Refund limits:
 *    - Stripe: Up to 90 days after charge
 *    - PayPal: Up to 180 days after transaction
 *
 * 4. Fees:
 *    - Stripe: Fees not refunded for partial refunds
 *    - PayPal: Fees refunded for full refunds only
 */
