import axios from 'axios';
import { randomUUID } from 'crypto';
import { z } from 'zod';
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

export class ConsoleSmsProvider implements SmsProvider {
  async send(message: SmsMessage): Promise<SmsDelivery> {
    const providerMessageId = `console-${randomUUID()}`;
    logger.info({ phoneLast4: message.to.slice(-4), providerMessageId }, 'SMS reminder logged by console provider');
    return { providerMessageId };
  }
}

export interface TwilioSmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber?: string;
  messagingServiceSid?: string;
}

const twilioResponseSchema = z.object({
  sid: z.string().min(1),
});

export class TwilioSmsProvider implements SmsProvider {
  constructor(private readonly config: TwilioSmsConfig) {}

  async send(message: SmsMessage): Promise<SmsDelivery> {
    const { accountSid, authToken, fromNumber, messagingServiceSid } = this.config;
    const params = new URLSearchParams({
      To: message.to,
      Body: message.body,
      ...(messagingServiceSid ? { MessagingServiceSid: messagingServiceSid } : { From: fromNumber! }),
    });
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;

    try {
      const response = await axios.post(url, params.toString(), {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });
      const parsed = twilioResponseSchema.parse(response.data);
      logger.info({ phoneLast4: message.to.slice(-4), providerMessageId: parsed.sid }, 'SMS reminder sent via Twilio');
      return { providerMessageId: parsed.sid };
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const twilioCode = axios.isAxiosError(err) ? (err.response?.data as { code?: number } | undefined)?.code : undefined;
      throw new Error(`Twilio SMS delivery failed${status ? ` (HTTP ${status}${twilioCode ? `, code ${twilioCode}` : ''})` : ''}`);
    }
  }
}

export function getSmsProvider(): SmsProvider {
  // The open-source default never contacts an external SMS provider. Add a
  // provider adapter only when the deployment owner configures one.
  if (env.SMS_PROVIDER === 'console') return new ConsoleSmsProvider();
  if (env.SMS_PROVIDER === 'twilio') {
    return new TwilioSmsProvider({
      accountSid: env.TWILIO_ACCOUNT_SID!,
      authToken: env.TWILIO_AUTH_TOKEN!,
      fromNumber: env.TWILIO_FROM_NUMBER,
      messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
    });
  }
  throw new Error(`Unsupported SMS provider: ${env.SMS_PROVIDER}`);
}
