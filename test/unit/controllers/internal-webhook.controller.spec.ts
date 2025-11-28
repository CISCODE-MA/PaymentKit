import { InternalWebhookController } from '@src/nest/controllers/internal-webhook.controller';

describe('InternalWebhookController', () => {
  it('can be instantiated', async () => {
    const controller = new InternalWebhookController();

    expect(controller).toBeDefined();

    await expect(
      controller.handleInternalWebhook({ foo: 'bar' }, { 'x-test-header': 'value' }),
    ).resolves.toBeUndefined();
  });
});
