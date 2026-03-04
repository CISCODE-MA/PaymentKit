import { NormalizedErrorCode } from '@src/common/errors/normalized-error.model';
import { PaymentStatus } from '@src/core/entities/payment-status.enum';
import type {
  PaypalPaymentsClient,
  CreatePaypalPaymentResult,
  GetPaypalPaymentStatusResult,
  RefundPaypalPaymentResult,
} from '@src/core/gateways/paypal/paypal-payments.client';
import { PaypalGateway } from '@src/core/gateways/paypal/paypal.gateway';
import type {
  CreatePaymentCommand,
  GetPaymentStatusQuery,
  RefundPaymentCommand,
} from '@src/core/ports/payment-gateway.port';
import type { Money } from '@src/core/value-objects/money.value-object';

class FakePaypalPaymentsClient implements Partial<PaypalPaymentsClient> {
  public createResult!: CreatePaypalPaymentResult;
  public statusResult!: GetPaypalPaymentStatusResult;
  public refundResult!: RefundPaypalPaymentResult;

  // No async, just return Promise.resolve → fixes require-await
  createPayment(): Promise<CreatePaypalPaymentResult> {
    return Promise.resolve(this.createResult);
  }

  getPaymentStatus(): Promise<GetPaypalPaymentStatusResult> {
    return Promise.resolve(this.statusResult);
  }

  refundPayment(): Promise<RefundPaypalPaymentResult> {
    return Promise.resolve(this.refundResult);
  }
}

const makeMoney = (overrides: Partial<Money> = {}): Money => ({
  currency: 'USD',
  amount: 1000,
  ...overrides,
});

describe('PaypalGateway', () => {
  it('creates a payment successfully', async () => {
    const fake = new FakePaypalPaymentsClient();
    fake.createResult = {
      ok: true,
      orderId: 'ORDER-1',
      status: 'COMPLETED',
      raw: {
        id: 'ORDER-1',
        status: 'COMPLETED',
      },
    };

    const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);

    const command: CreatePaymentCommand = {
      gateway: 'paypal',
      amount: makeMoney(),
      idempotencyKey: 'idem-123',
      metadata: { foo: 'bar' },
    };

    const result = await gateway.createPayment(command);

    expect(result.error).toBeUndefined();
    expect(result.payment).not.toBeNull();

    const payment = result.payment!;
    expect(payment.gateway).toBe('paypal');
    expect(payment.gatewayPaymentId).toBe('ORDER-1');
    expect(payment.status).toBe(PaymentStatus.Captured);
    expect(payment.amount).toEqual(command.amount);
    expect(payment.metadata).toEqual({ foo: 'bar' });
  });

  it('propagates normalized error from createPayment', async () => {
    const fake = new FakePaypalPaymentsClient();
    fake.createResult = {
      ok: false,
      error: {
        code: NormalizedErrorCode.InvalidRequest,
        message: 'Bad request',
        gateway: 'paypal',
      },
    };

    const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);

    const command: CreatePaymentCommand = {
      gateway: 'paypal',
      amount: makeMoney(),
    };

    const result = await gateway.createPayment(command);

    expect(result.payment).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe(NormalizedErrorCode.InvalidRequest);
  });

  it('returns error when getPaymentStatus called without ids', async () => {
    const fake = new FakePaypalPaymentsClient();
    const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);

    const query: GetPaymentStatusQuery = {
      gateway: 'paypal',
    };

    const result = await gateway.getPaymentStatus(query);

    expect(result.status).toBeNull();
    expect(result.payment).toBeNull();
    expect(result.error?.code).toBe(NormalizedErrorCode.InvalidRequest);
  });

  it('gets payment status successfully and maps to Payment', async () => {
    const fake = new FakePaypalPaymentsClient();
    fake.statusResult = {
      ok: true,
      orderId: 'ORDER-1',
      status: 'COMPLETED',
      raw: {
        id: 'ORDER-1',
        status: 'COMPLETED',
        purchase_units: [
          {
            amount: {
              value: '10.00',
              currency_code: 'USD',
            },
          },
        ],
      },
    };

    const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);

    const query: GetPaymentStatusQuery = {
      gateway: 'paypal',
      gatewayPaymentId: 'ORDER-1',
    };

    const result = await gateway.getPaymentStatus(query);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(PaymentStatus.Captured);
    expect(result.payment).not.toBeNull();

    const payment = result.payment!;
    expect(payment.gatewayPaymentId).toBe('ORDER-1');
    expect(payment.amount.currency).toBe('USD');
    expect(payment.amount.amount).toBe(1000);
  });

  it('refunds successfully and returns a Refund', async () => {
    const fake = new FakePaypalPaymentsClient();
    fake.refundResult = {
      ok: true,
      refundId: 'REF-1',
      status: 'COMPLETED',
      raw: {},
    };

    const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);

    const command: RefundPaymentCommand = {
      gateway: 'paypal',
      paymentId: 'CAPTURE-1',
      amount: makeMoney({ amount: 500 }),
      idempotencyKey: 'idem-refund',
    };

    const result = await gateway.refundPayment(command);

    expect(result.error).toBeUndefined();
    expect(result.refund).not.toBeNull();

    // Avoid `any`: define a minimal structural type
    const refund = result.refund as unknown as {
      gateway: string;
      paymentId: string;
    };

    expect(refund.gateway).toBe('paypal');
    expect(refund.paymentId).toBe('CAPTURE-1');
  });

  it('propagates normalized error from refundPayment', async () => {
    const fake = new FakePaypalPaymentsClient();
    fake.refundResult = {
      ok: false,
      error: {
        code: NormalizedErrorCode.InternalError,
        message: 'Oops',
        gateway: 'paypal',
      },
    };

    const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);

    const command: RefundPaymentCommand = {
      gateway: 'paypal',
      paymentId: 'CAPTURE-1',
    };

    const result = await gateway.refundPayment(command);

    expect(result.refund).toBeNull();
    expect(result.error?.code).toBe(NormalizedErrorCode.InternalError);
  });
});
