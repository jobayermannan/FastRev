import { randomUUID } from 'crypto';
import { env } from '../common/config/env';
import { logger } from '../common/logger';

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsDelivery {
  providerMessageId: string;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<SmsDelivery>;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(message: SmsMessage): Promise<SmsDelivery> {
    const providerMessageId = `console-${randomUUID()}`;
    logger.info({ phoneLast4: message.to.slice(-4), providerMessageId }, 'SMS reminder logged by console provider');
    return { providerMessageId };
  }
}

export function getSmsProvider(): SmsProvider {
  // The open-source default never contacts an external SMS provider. Add a
  // provider adapter only when the deployment owner configures one.
  if (env.SMS_PROVIDER === 'console') return new ConsoleSmsProvider();
  throw new Error(`Unsupported SMS provider: ${env.SMS_PROVIDER}`);
}
