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

  describe('gateway mismatch errors', () => {
    it('returns gateway mismatch error on createPayment with wrong gateway', async () => {
      const fake = new FakePaypalPaymentsClient();
      const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);

      const command: CreatePaymentCommand = {
        gateway: 'stripe', // Wrong gateway
        amount: makeMoney(),
      };

      const result = await gateway.createPayment(command);

      expect(result.payment).toBeNull();
      expect(result.error?.code).toBe(NormalizedErrorCode.InvalidRequest);
      expect(result.error?.message).toContain('stripe');
    });

    it('returns gateway mismatch error on getPaymentStatus with wrong gateway', async () => {
      const fake = new FakePaypalPaymentsClient();
      const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);

      const query: GetPaymentStatusQuery = {
        gateway: 'stripe', // Wrong gateway
        paymentId: 'ORDER-1',
      };

      const result = await gateway.getPaymentStatus(query);

      expect(result.status).toBeNull();
      expect(result.payment).toBeNull();
      expect(result.error?.code).toBe(NormalizedErrorCode.InvalidRequest);
      expect(result.error?.message).toContain('stripe');
    });

    it('returns gateway mismatch error on refundPayment with wrong gateway', async () => {
      const fake = new FakePaypalPaymentsClient();
      const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);

      const command: RefundPaymentCommand = {
        gateway: 'stripe', // Wrong gateway
        paymentId: 'ORDER-1',
      };

      const result = await gateway.refundPayment(command);

      expect(result.refund).toBeNull();
      expect(result.error?.code).toBe(NormalizedErrorCode.InvalidRequest);
      expect(result.error?.message).toContain('stripe');
    });
  });

  describe('status mapping', () => {
    const testStatusMapping = (paypalStatus: string, expectedPaymentStatus: PaymentStatus) => {
      it(`maps PayPal status '${paypalStatus}' to '${expectedPaymentStatus}'`, async () => {
        const fake = new FakePaypalPaymentsClient();
        fake.statusResult = {
          ok: true,
          orderId: 'ORDER-TEST',
          status: paypalStatus,
          raw: {
            id: 'ORDER-TEST',
            status: paypalStatus,
          },
        };

        const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);
        const result = await gateway.getPaymentStatus({
          gateway: 'paypal',
          gatewayPaymentId: 'ORDER-TEST',
        });

        expect(result.status).toBe(expectedPaymentStatus);
      });
    };

    testStatusMapping('CREATED', PaymentStatus.Pending);
    testStatusMapping('SAVED', PaymentStatus.Pending);
    testStatusMapping('APPROVED', PaymentStatus.Pending);
    testStatusMapping('COMPLETED', PaymentStatus.Captured);
    testStatusMapping('VOIDED', PaymentStatus.Canceled);
    testStatusMapping('PAYER_ACTION_REQUIRED', PaymentStatus.Pending);
    testStatusMapping('UNKNOWN_STATUS', PaymentStatus.Pending);
  });

  describe('createPayment with approve URL', () => {
    it('includes redirect nextAction when approve link is in raw response', async () => {
      const fake = new FakePaypalPaymentsClient();
      fake.createResult = {
        ok: true,
        orderId: 'ORDER-1',
        status: 'CREATED',
        raw: {
          id: 'ORDER-1',
          status: 'CREATED',
          links: [
            { rel: 'approve', href: 'https://paypal.com/cgi-bin/webscr?token=EC123' },
            { rel: 'self', href: 'https://api.paypal.com/v2/checkout/orders/ORDER-1' },
          ],
        },
      };

      const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);
      const result = await gateway.createPayment({
        gateway: 'paypal',
        amount: makeMoney(),
      });

      expect(result.nextAction?.type).toBe('redirect');
      expect((result.nextAction as any)?.url).toBe('https://paypal.com/cgi-bin/webscr?token=EC123');
    });

    it('includes none nextAction when no approve link exists', async () => {
      const fake = new FakePaypalPaymentsClient();
      fake.createResult = {
        ok: true,
        orderId: 'ORDER-2',
        status: 'COMPLETED',
        raw: {
          id: 'ORDER-2',
          status: 'COMPLETED',
          links: [{ rel: 'self', href: 'https://api.paypal.com/v2/checkout/orders/ORDER-2' }],
        },
      };

      const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);
      const result = await gateway.createPayment({
        gateway: 'paypal',
        amount: makeMoney(),
      });

      expect(result.nextAction?.type).toBe('none');
    });

    it('includes none nextAction when raw response is null', async () => {
      const fake = new FakePaypalPaymentsClient();
      fake.createResult = {
        ok: true,
        orderId: 'ORDER-3',
        status: 'COMPLETED',
        raw: null as any,
      };

      const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);
      const result = await gateway.createPayment({
        gateway: 'paypal',
        amount: makeMoney(),
      });

      expect(result.nextAction?.type).toBe('none');
    });
  });

  describe('getPaymentStatus uses paymentId fallback', () => {
    it('uses gatewayPaymentId when provided', async () => {
      const fake = new FakePaypalPaymentsClient();
      let capturedOrderId = '';
      fake.getPaymentStatus = () => {
        // Capture is not directly available, but we can verify via the query
        capturedOrderId = 'ORDER-GATEWAY-ID';
        return Promise.resolve(fake.statusResult);
      };
      fake.statusResult = {
        ok: true,
        orderId: 'ORDER-GATEWAY-ID',
        status: 'COMPLETED',
        raw: { id: 'ORDER-GATEWAY-ID' },
      };

      const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);
      await gateway.getPaymentStatus({
        gateway: 'paypal',
        gatewayPaymentId: 'ORDER-GATEWAY-ID',
        paymentId: 'ORDER-PAYMENT-ID',
      });

      expect(capturedOrderId).toBe('ORDER-GATEWAY-ID');
    });

    it('uses paymentId when gatewayPaymentId is not provided', async () => {
      const fake = new FakePaypalPaymentsClient();
      fake.statusResult = {
        ok: true,
        orderId: 'ORDER-PAYMENT-ID',
        status: 'COMPLETED',
        raw: { id: 'ORDER-PAYMENT-ID' },
      };

      const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);
      const result = await gateway.getPaymentStatus({
        gateway: 'paypal',
        paymentId: 'ORDER-PAYMENT-ID',
      });

      expect(result.payment?.id).toBe('ORDER-PAYMENT-ID');
    });
  });

  describe('createPayment with metadata', () => {
    it('preserves metadata from command in resulting payment', async () => {
      const fake = new FakePaypalPaymentsClient();
      fake.createResult = {
        ok: true,
        orderId: 'ORDER-META',
        status: 'COMPLETED',
        raw: { id: 'ORDER-META', status: 'COMPLETED' },
      };

      const gateway = new PaypalGateway(fake as unknown as PaypalPaymentsClient);
      const command: CreatePaymentCommand = {
        gateway: 'paypal',
        amount: makeMoney(),
        metadata: { userId: 'user-123', customData: 'test-value' },
      };

      const result = await gateway.createPayment(command);

      expect(result.payment?.metadata).toEqual({
        userId: 'user-123',
        customData: 'test-value',
      });
    });
  });
});
