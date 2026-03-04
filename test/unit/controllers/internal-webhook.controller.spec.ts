import { BadRequestException } from '@nestjs/common';
import type { WebhookGatewayRouter } from '@src/core/services/webhook-gateway-router.service';
import { InternalWebhookController } from '@src/nest/controllers/internal-webhook.controller';

class FakeRouter implements WebhookGatewayRouter {
  public readonly routes: Array<{
    gateway: string;
    body: unknown;
    headers: Record<string, string | string[]>;
  }> = [];

  // @ts-expect-error - match interface shape enough for tests
  route(input: {
    gateway: string;
    body: unknown;
    headers: Record<string, string | string[]>;
  }): Promise<void> {
    this.routes.push(input);
    return Promise.resolve();
  }
}

describe('InternalWebhookController', () => {
  it('throws BadRequestException when x-paymentkit-gateway header is missing', async () => {
    const router = new FakeRouter();
    const controller = new InternalWebhookController(router as unknown as WebhookGatewayRouter);

    await expect(controller.handleInternalWebhook({ foo: 'bar' }, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('routes to the router when gateway header is valid', async () => {
    const router = new FakeRouter();
    const controller = new InternalWebhookController(router as unknown as WebhookGatewayRouter);

    const body = { foo: 'bar' };
    const headers = { 'x-paymentkit-gateway': 'stripe' };

    await controller.handleInternalWebhook(body, headers);

    expect(router.routes).toHaveLength(1);
    const call = router.routes[0];

    expect(call.gateway).toBe('stripe');
    expect(call.body).toBe(body);
    expect(call.headers).toBe(headers);
  });
});
