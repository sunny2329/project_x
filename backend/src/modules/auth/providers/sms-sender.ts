import twilio from 'twilio';
import { AppError } from '../../../utils/app-error.js';

/** Delivers a text message. Codes are generated, stored (`auth_otp`) and checked by OtpService. */
export interface SmsSender {
  send(to: string, body: string): Promise<void>;
}

// https://www.twilio.com/docs/api/errors
const TWILIO_INVALID_TO_NUMBER = 21211;
const TWILIO_REGION_NOT_ENABLED = 21408;
const TWILIO_NOT_MOBILE = 21614;

function twilioErrorCode(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number') {
    return error.code;
  }
  return undefined;
}

export class TwilioSmsSender implements SmsSender {
  private readonly client;

  constructor(
    accountSid: string,
    authToken: string,
    private readonly from: string,
  ) {
    this.client = twilio(accountSid, authToken);
  }

  async send(to: string, body: string): Promise<void> {
    try {
      await this.client.messages.create({ to, from: this.from, body });
    } catch (error) {
      switch (twilioErrorCode(error)) {
        case TWILIO_INVALID_TO_NUMBER:
        case TWILIO_REGION_NOT_ENABLED:
        case TWILIO_NOT_MOBILE:
          throw AppError.badRequest('INVALID_PHONE', 'This phone number cannot receive SMS codes.');
        default:
          throw AppError.serviceUnavailable('SMS_UNAVAILABLE', 'We could not send an SMS right now. Try again shortly.');
      }
    }
  }
}

/**
 * Development/test only (rejected in production by env validation): sends nothing and records
 * the recipients. Paired with a code generator that always returns DEV_OTP_CODE.
 */
export class DevSmsSender implements SmsSender {
  readonly sentTo: string[] = [];

  async send(to: string): Promise<void> {
    this.sentTo.push(to);
  }
}
