import { DefaultPaymentEngine } from '@src/core/services/payment-engine.service';
import type { PaymentEngine } from '@src/core/ports/payment-engine.port';
import {
  type CreatePaymentCommand,
  type CreatePaymentResult,
  type GetPaymentStatusQuery,
  type GetPaymentStatusResult,
  type RefundPaymentCommand,
  type RefundPaymentResult,
  type PaymentGateway,
} from '@core/ports/payment-gateway.port';
import { InMemoryGatewayRegistry } from '@src/core/services/gateway-registry.service';
import type { GatewayRegistry } from '@src/core/services/gateway-registry.service';
import type { ErrorNormalizer } from '@src/core/services/error-normalizer.service';
import { NormalizedErrorCode, type NormalizedError } from '@common/errors/normalized-error.model';
import type { GatewayKey } from '@common/types/gateway.types';
import type { Money } from '@src/core/value-objects/money.value-object';
import { PaymentStatus } from '@src/core/entities/payment-status.enum';
import type { Payment } from '@src/core/entities/payment.entity';
import type { Refund } from '@src/core/entities/refund.entity';

class FakeErrorNormalizer implements ErrorNormalizer {
  public lastError: unknown;

  normalize(error: unknown, context: { gateway: GatewayKey }): NormalizedError {
    this.lastError = { error, gateway: context.gateway };

    return {
      code: NormalizedErrorCode.InternalError,
      message: 'Normalized error',
      gateway: context.gateway,
      isRetriable: true,
    };
  }
}

type GatewayBehaviour =
  | 'success'
  | 'returnsError'
  | 'throwsOnCreate'
  | 'throwsOnStatus'
  | 'throwsOnRefund';

class FakeGateway implements PaymentGateway {
  constructor(
    public readonly key: GatewayKey,
    private readonly behaviour: GatewayBehaviour,
  ) {}

  createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    void command;

    if (this.behaviour === 'throwsOnCreate') {
      return Promise.reject(new Error('create failed'));
    }

    if (this.behaviour === 'returnsError') {
      const error: NormalizedError = {
        code: NormalizedErrorCode.InvalidRequest,
        message: 'Bad card data',
        gateway: this.key,
      };

      return Promise.resolve({
        payment: null,
        error,
      });
    }

    const amount: Money = { currency: 'USD', amount: 1000 };
    const payment: Payment = {
      id: 'pay_1',
      gateway: this.key,
      gatewayPaymentId: 'gw_pay_1',
      amount,
      status: PaymentStatus.Pending,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return Promise.resolve({
      payment,
    });
  }

  getPaymentStatus(query: GetPaymentStatusQuery): Promise<GetPaymentStatusResult> {
    void query;

    if (this.behaviour === 'throwsOnStatus') {
      return Promise.reject(new Error('status failed'));
    }

    return Promise.resolve({
      status: PaymentStatus.Captured,
      payment: null,
    });
  }

  refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult> {
    void command;

    if (this.behaviour === 'throwsOnRefund') {
      return Promise.reject(new Error('refund failed'));
    }

    const amount: Money = { currency: 'USD', amount: 1000 };
    const refund: Refund = {
      id: 'refund_1',
      paymentId: 'pay_1',
      gateway: this.key,
      gatewayRefundId: 'gw_ref_1',
      amount,
      status: PaymentStatus.Refunded,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return Promise.resolve({
      refund,
    });
  }
}

describe('DefaultPaymentEngine', () => {
  const makeEngine = (
    gateways: PaymentGateway[],
  ): { engine: PaymentEngine; normalizer: FakeErrorNormalizer } => {
    const registry: GatewayRegistry = new InMemoryGatewayRegistry(gateways);
    const normalizer = new FakeErrorNormalizer();
    const engine: PaymentEngine = new DefaultPaymentEngine(registry, normalizer);
    return { engine, normalizer };
  };

  const baseCommand: CreatePaymentCommand = {
    gateway: 'stripe',
    amount: { currency: 'USD', amount: 1000 },
  };

  it('returns InvalidRequest error when gateway is not configured', async () => {
    const { engine, normalizer } = makeEngine([]);

    const result = await engine.createPayment(baseCommand);

    expect(result.payment).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe(NormalizedErrorCode.InvalidRequest);
    expect(result.error?.message).toMatch(/not configured/i);
    expect(normalizer.lastError).toBeUndefined();
  });

  it('passes through successful gateway createPayment result', async () => {
    const gateway = new FakeGateway('stripe', 'success');
    const { engine, normalizer } = makeEngine([gateway]);

    const result = await engine.createPayment(baseCommand);

    expect(result.error).toBeUndefined();
    expect(result.payment).not.toBeNull();
    expect(result.payment?.gateway).toBe('stripe');
    expect(normalizer.lastError).toBeUndefined();
  });

  it('passes through gateway error result (with gateway set)', async () => {
    const gateway = new FakeGateway('stripe', 'returnsError');
    const { engine, normalizer } = makeEngine([gateway]);

    const result = await engine.createPayment(baseCommand);

    expect(result.payment).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe(NormalizedErrorCode.InvalidRequest);
    expect(result.error?.gateway).toBe('stripe');
    expect(normalizer.lastError).toBeUndefined();
  });

  it('normalizes thrown errors from gateway createPayment', async () => {
    const gateway = new FakeGateway('stripe', 'throwsOnCreate');
    const { engine, normalizer } = makeEngine([gateway]);

    const result = await engine.createPayment(baseCommand);

    expect(result.payment).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe(NormalizedErrorCode.InternalError);
    expect(result.error?.gateway).toBe('stripe');
    expect(normalizer.lastError).toBeDefined();
  });

  it('normalizes thrown errors from getPaymentStatus', async () => {
    const gateway = new FakeGateway('stripe', 'throwsOnStatus');
    const { engine } = makeEngine([gateway]);

    const query: GetPaymentStatusQuery = {
      gateway: 'stripe',
      paymentId: 'pay_1',
    };

    const result = await engine.getPaymentStatus(query);

    expect(result.status).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('normalizes thrown errors from refundPayment', async () => {
    const gateway = new FakeGateway('stripe', 'throwsOnRefund');
    const { engine } = makeEngine([gateway]);

    const command: RefundPaymentCommand = {
      gateway: 'stripe',
      paymentId: 'pay_1',
    };

    const result = await engine.refundPayment(command);

    expect(result.refund).toBeNull();
    expect(result.error).toBeDefined();
  });
});
