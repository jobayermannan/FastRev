import { Router } from 'express';
import { inboundSmsWebhookController } from './notifications.webhook';

const router = Router();

router.post('/webhooks/sms', inboundSmsWebhookController);

export default router;
