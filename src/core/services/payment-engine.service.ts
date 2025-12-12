// src/core/services/payment-engine.service.ts

import type {
  CreatePaymentCommand,
  CreatePaymentResult,
  GetPaymentStatusQuery,
  GetPaymentStatusResult,
  RefundPaymentCommand,
  RefundPaymentResult,
  PaymentGateway,
} from '@core/ports/payment-gateway.port';
import type { PaymentEngine } from '@core/ports/payment-engine.port';
import type { GatewayRegistry } from '@src/core/services/gateway-registry.service';
import type { ErrorNormalizer } from '@src/core/services/error-normalizer.service';
import type { GatewayKey } from '@common/types/gateway.types';
import { NormalizedErrorCode, type NormalizedError } from '@common/errors/normalized-error.model';

/**
 * Default engine orchestrating calls to underlying gateways.
 */
export class DefaultPaymentEngine implements PaymentEngine {
  constructor(
    private readonly registry: GatewayRegistry,
    private readonly errorNormalizer: ErrorNormalizer,
  ) {}

  async createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    const gateway = this.getGatewayOrNull(command.gateway);

    if (!gateway) {
      return {
        payment: null,
        error: this.buildGatewayNotConfiguredError(command.gateway),
      };
    }

    try {
      const result = await gateway.createPayment(command);

      if (result.error) {
        // Ensure gateway field is set on errors coming from gateways
        return {
          ...result,
          error: this.ensureGatewayOnError(result.error, command.gateway),
        };
      }

      return result;
    } catch (err) {
      const normalized = this.errorNormalizer.normalize(err, {
        gateway: command.gateway,
      });

      return {
        payment: null,
        error: normalized,
      };
    }
  }

  async getPaymentStatus(query: GetPaymentStatusQuery): Promise<GetPaymentStatusResult> {
    const gateway = this.getGatewayOrNull(query.gateway);

    if (!gateway) {
      return {
        status: null,
        payment: null,
        error: this.buildGatewayNotConfiguredError(query.gateway),
      };
    }

    try {
      const result = await gateway.getPaymentStatus(query);

      if (result.error) {
        return {
          ...result,
          error: this.ensureGatewayOnError(result.error, query.gateway),
        };
      }

      return result;
    } catch (err) {
      const normalized = this.errorNormalizer.normalize(err, {
        gateway: query.gateway,
      });

      return {
        status: null,
        payment: null,
        error: normalized,
      };
    }
  }

  async refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult> {
    const gateway = this.getGatewayOrNull(command.gateway);

    if (!gateway) {
      return {
        refund: null,
        error: this.buildGatewayNotConfiguredError(command.gateway),
      };
    }

    try {
      const result = await gateway.refundPayment(command);

      if (result.error) {
        return {
          ...result,
          error: this.ensureGatewayOnError(result.error, command.gateway),
        };
      }

      return result;
    } catch (err) {
      const normalized = this.errorNormalizer.normalize(err, {
        gateway: command.gateway,
      });

      return {
        refund: null,
        error: normalized,
      };
    }
  }

  private getGatewayOrNull(key: GatewayKey): PaymentGateway | undefined {
    return this.registry.get(key);
  }

  private buildGatewayNotConfiguredError(gateway: GatewayKey): NormalizedError {
    return {
      code: NormalizedErrorCode.InvalidRequest,
      message: `Gateway "${gateway}" is not configured in PaymentKit`,
      gateway,
      isRetriable: false,
    };
  }

  private ensureGatewayOnError(error: NormalizedError, gateway: GatewayKey): NormalizedError {
    if (!error.gateway) {
      return { ...error, gateway };
    }
    return error;
  }
}
