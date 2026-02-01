/**
 * Error Handling Example
 *
 * Comprehensive patterns for handling errors in payment operations.
 * PaymentKit normalizes all gateway errors into consistent error codes.
 */

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PaymentsService } from '@ciscode/paymentkit';
import { CreatePaymentCommand, NormalizedError, NormalizedErrorCode } from '@ciscode/paymentkit';

@Injectable()
export class PaymentErrorHandlingService {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * Example 1: Basic error handling with try-catch
   */
  async createPaymentWithBasicErrorHandling(amount: number, gateway: 'stripe' | 'paypal') {
    try {
      const command: CreatePaymentCommand = {
        gateway,
        amount: { currency: 'USD', amount },
      };

      const result = await this.payments.createPayment(command);

      // Check for errors in result
      if (result.error) {
        return this.handlePaymentError(result.error);
      }

      return {
        success: true,
        payment: result.payment,
        nextAction: result.nextAction,
      };
    } catch (error) {
      // Unexpected errors (network issues, etc.)
      console.error('Unexpected error:', error);
      throw new HttpException('Payment service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Example 2: Detailed error code handling
   */
  private handlePaymentError(error: NormalizedError): never {
    switch (error.code) {
      case NormalizedErrorCode.CardDeclined:
        throw new HttpException(
          {
            error: 'card_declined',
            message: 'Your card was declined. Please try a different payment method.',
            userMessage: 'Card declined',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );

      case NormalizedErrorCode.InsufficientFunds:
        throw new HttpException(
          {
            error: 'insufficient_funds',
            message: 'Insufficient funds. Please use a different card.',
            userMessage: 'Insufficient funds',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );

      case NormalizedErrorCode.InvalidRequest:
        throw new HttpException(
          {
            error: 'invalid_request',
            message: error.message,
            userMessage: 'Invalid payment details',
          },
          HttpStatus.BAD_REQUEST,
        );

      case NormalizedErrorCode.Unauthorized:
        throw new HttpException(
          {
            error: 'unauthorized',
            message: 'Payment gateway authentication failed',
            userMessage: 'Payment service error',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );

      case NormalizedErrorCode.RateLimitExceeded:
        throw new HttpException(
          {
            error: 'rate_limit',
            message: 'Too many payment attempts. Please try again later.',
            userMessage: 'Too many attempts',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );

      case NormalizedErrorCode.GatewayError:
        throw new HttpException(
          {
            error: 'gateway_error',
            message: 'Payment gateway error. Please try again.',
            userMessage: 'Service temporarily unavailable',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );

      case NormalizedErrorCode.NetworkError:
        throw new HttpException(
          {
            error: 'network_error',
            message: 'Network error communicating with payment gateway',
            userMessage: 'Connection error',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );

      default:
        throw new HttpException(
          {
            error: 'unknown_error',
            message: error.message || 'An unknown error occurred',
            userMessage: 'Payment failed',
            details: error.details,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
  }

  /**
   * Example 3: Retry logic with exponential backoff
   */
  async createPaymentWithRetry(command: CreatePaymentCommand, maxRetries = 3): Promise<any> {
    let lastError: NormalizedError | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.payments.createPayment(command);

        if (result.error) {
          lastError = result.error;

          // Only retry on specific error codes
          const retryableErrors = [
            NormalizedErrorCode.NetworkError,
            NormalizedErrorCode.GatewayError,
            NormalizedErrorCode.RateLimitExceeded,
          ];

          if (!retryableErrors.includes(result.error.code)) {
            // Don't retry, fail immediately
            return this.handlePaymentError(result.error);
          }

          // Calculate backoff delay
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);

          await this.sleep(delay);
          continue;
        }

        // Success
        return {
          success: true,
          payment: result.payment,
          nextAction: result.nextAction,
          attempts: attempt,
        };
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          throw error;
        }

        await this.sleep(1000 * attempt);
      }
    }

    // All retries exhausted
    if (lastError) {
      return this.handlePaymentError(lastError);
    }

    throw new HttpException('Payment failed after retries', HttpStatus.SERVICE_UNAVAILABLE);
  }

  /**
   * Example 4: Fallback gateway on failure
   */
  async createPaymentWithFallback(
    amount: number,
    currency: string,
    primaryGateway: 'stripe' | 'paypal' = 'stripe',
  ) {
    const fallbackGateway = primaryGateway === 'stripe' ? 'paypal' : 'stripe';

    // Try primary gateway
    const primaryCommand: CreatePaymentCommand = {
      gateway: primaryGateway,
      amount: { currency, amount },
      idempotencyKey: `payment_${Date.now()}_primary`,
    };

    const primaryResult = await this.payments.createPayment(primaryCommand);

    if (!primaryResult.error) {
      return {
        success: true,
        gateway: primaryGateway,
        payment: primaryResult.payment,
        nextAction: primaryResult.nextAction,
      };
    }

    // Check if error is gateway-specific (should try fallback)
    const shouldFallback = [
      NormalizedErrorCode.GatewayError,
      NormalizedErrorCode.NetworkError,
      NormalizedErrorCode.RateLimitExceeded,
    ].includes(primaryResult.error.code);

    if (!shouldFallback) {
      // User error, don't fallback
      return this.handlePaymentError(primaryResult.error);
    }

    console.log(`Primary gateway failed, trying fallback: ${fallbackGateway}`);

    // Try fallback gateway
    const fallbackCommand: CreatePaymentCommand = {
      gateway: fallbackGateway,
      amount: { currency, amount },
      idempotencyKey: `payment_${Date.now()}_fallback`,
    };

    const fallbackResult = await this.payments.createPayment(fallbackCommand);

    if (fallbackResult.error) {
      // Both failed
      throw new HttpException(
        {
          error: 'both_gateways_failed',
          message: 'All payment gateways are unavailable',
          userMessage: 'Payment services temporarily unavailable',
          primaryError: primaryResult.error,
          fallbackError: fallbackResult.error,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      success: true,
      gateway: fallbackGateway,
      usedFallback: true,
      payment: fallbackResult.payment,
      nextAction: fallbackResult.nextAction,
    };
  }

  /**
   * Example 5: Validation before payment
   */
  async createPaymentWithValidation(
    amount: number,
    currency: string,
    gateway: 'stripe' | 'paypal',
  ) {
    // Validate amount
    if (amount <= 0) {
      throw new HttpException('Amount must be greater than 0', HttpStatus.BAD_REQUEST);
    }

    // Validate minimum amounts
    const minimums: Record<string, number> = {
      USD: 50, // $0.50
      EUR: 50,
      GBP: 30,
    };

    if (amount < (minimums[currency] || 50)) {
      throw new HttpException(
        `Minimum amount for ${currency} is ${minimums[currency] || 50} cents`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate currency support
    const supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
    if (!supportedCurrencies.includes(currency)) {
      throw new HttpException(`Currency ${currency} is not supported`, HttpStatus.BAD_REQUEST);
    }

    // Create payment
    const command: CreatePaymentCommand = {
      gateway,
      amount: { currency, amount },
    };

    const result = await this.payments.createPayment(command);

    if (result.error) {
      return this.handlePaymentError(result.error);
    }

    return {
      success: true,
      payment: result.payment,
      nextAction: result.nextAction,
    };
  }

  /**
   * Example 6: Logging and monitoring
   */
  async createPaymentWithMonitoring(command: CreatePaymentCommand) {
    const startTime = Date.now();

    try {
      // Log payment attempt
      console.log('Payment attempt:', {
        gateway: command.gateway,
        amount: command.amount,
        timestamp: new Date().toISOString(),
      });

      const result = await this.payments.createPayment(command);
      const duration = Date.now() - startTime;

      if (result.error) {
        // Log payment failure
        console.error('Payment failed:', {
          gateway: command.gateway,
          errorCode: result.error.code,
          errorMessage: result.error.message,
          duration,
        });

        // Send to monitoring service (Sentry, Datadog, etc.)
        this.reportError(result.error, {
          gateway: command.gateway,
          amount: command.amount.amount,
          duration,
        });

        return this.handlePaymentError(result.error);
      }

      // Log payment success
      console.log('Payment succeeded:', {
        gateway: command.gateway,
        paymentId: result.payment?.id,
        duration,
      });

      // Track metrics
      this.trackMetric('payment.success', {
        gateway: command.gateway,
        duration,
      });

      return {
        success: true,
        payment: result.payment,
        nextAction: result.nextAction,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log unexpected error
      console.error('Unexpected payment error:', error);

      // Send to monitoring
      this.reportError(error, {
        gateway: command.gateway,
        duration,
      });

      throw error;
    }
  }

  // Helper methods

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private reportError(error: any, context: any): void {
    // Send to Sentry, Datadog, etc.
    console.log('Reporting error to monitoring service:', { error, context });
  }

  private trackMetric(name: string, data: any): void {
    // Send to metrics service
    console.log('Tracking metric:', name, data);
  }
}

/**
 * Complete error codes reference:
 *
 * - CardDeclined: Card was declined by issuer
 * - InsufficientFunds: Card has insufficient funds
 * - InvalidRequest: Invalid parameters in request
 * - PaymentMethodInvalid: Payment method is invalid/expired
 * - Unauthorized: Gateway authentication failed
 * - RateLimitExceeded: Too many requests to gateway
 * - GatewayError: Gateway service error
 * - NetworkError: Network communication error
 * - Unknown: Unclassified error
 */

/**
 * Usage in controller:
 *
 * @Controller('payments')
 * export class PaymentsController {
 *   constructor(private readonly errorHandling: PaymentErrorHandlingService) {}
 *
 *   @Post()
 *   async create(@Body() dto: CreatePaymentDto) {
 *     // All errors are automatically converted to HTTP exceptions
 *     return this.errorHandling.createPaymentWithValidation(
 *       dto.amount,
 *       dto.currency,
 *       dto.gateway,
 *     );
 *   }
 *
 *   @Post('with-retry')
 *   async createWithRetry(@Body() dto: CreatePaymentDto) {
 *     return this.errorHandling.createPaymentWithRetry({
 *       gateway: dto.gateway,
 *       amount: { currency: dto.currency, amount: dto.amount },
 *     });
 *   }
 *
 *   @Post('with-fallback')
 *   async createWithFallback(@Body() dto: CreatePaymentDto) {
 *     return this.errorHandling.createPaymentWithFallback(
 *       dto.amount,
 *       dto.currency,
 *       dto.gateway,
 *     );
 *   }
 * }
 */
