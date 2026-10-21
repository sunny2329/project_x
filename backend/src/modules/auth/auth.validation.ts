import { z } from 'zod';
import type { Identifier } from './auth.types.js';
import { parseE164 } from './phone.js';

export const E164_PHONE = /^\+[1-9]\d{7,14}$/;

const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'));

/** E.164 input, split into the calling code and national number the schema stores. */
const phone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\-()]/g, ''))
  .pipe(z.string().regex(E164_PHONE, 'Enter a valid phone number including country code'))
  .transform((value, ctx) => {
    const parsed = parseE164(value);
    if (!parsed) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number including country code' });
      return z.NEVER;
    }
    return parsed;
  });

/** Must contain a letter, so a username can never be mistaken for a phone number. */
const username = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[A-Za-z0-9_.]+$/, 'Use only letters, numbers, "_" and "."')
  .regex(/[A-Za-z]/, 'Username must contain a letter');

const fullName = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters');

export const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const otpCode = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');

const PHONE_LIKE = /^[+\d\s\-()]+$/;

/** Contains "@" -> email; only digits, "+" and separators -> E.164 phone; anything else -> username. */
const identifier = z
  .string()
  .trim()
  .min(1, 'Enter your username, email or phone')
  .max(254)
  .transform((value, ctx): Identifier => {
    if (value.includes('@')) {
      const parsed = email.safeParse(value);
      if (parsed.success) return { kind: 'email', value: parsed.data };
    } else if (PHONE_LIKE.test(value)) {
      const parsed = phone.safeParse(value);
      if (parsed.success) return { kind: 'phone', value: parsed.data };
    } else {
      const parsed = username.safeParse(value);
      if (parsed.success) return { kind: 'username', value: parsed.data };
    }
    ctx.addIssue({ code: 'custom', message: 'Enter a valid username, email or phone number' });
    return z.NEVER;
  });

/** Step 1: the phone to text a code to, and the username to reserve. */
export const registerStartSchema = z.object({ phone, username });
/** Step 2: the code; answers with a short-lived registration token. */
export const registerVerifySchema = z.object({ phone, code: otpCode });
/** Step 3: the details; the token proves the phone was verified. */
export const registerCompleteSchema = z.object({
  registrationToken: z.string().min(16).max(2048),
  username,
  fullName,
  /** "Name on scoreboards"; defaults to the full name. */
  displayName: z.string().trim().min(1, 'Enter a name for scoreboards').max(40, 'At most 40 characters').optional(),
  email: email.optional(),
  password: newPassword,
});
export const usernameQuerySchema = z.object({ username: z.string().trim().max(60) });
export const loginSchema = z.object({ identifier, password: z.string().min(1, 'Enter your password').max(128) });
export const phoneStartSchema = z.object({ phone });
export const phoneVerifySchema = z.object({ phone, code: otpCode });
export const forgotPasswordSchema = z.object({ identifier });
export const resetPasswordSchema = z.object({ identifier, code: otpCode, newPassword });
export const googleSignInSchema = z.object({ idToken: z.string().min(1).max(4096) });
export const appleSignInSchema = z.object({
  identityToken: z.string().min(1).max(4096),
  fullName: z.string().trim().max(100).optional(),
});
export const refreshTokenSchema = z.object({ refreshToken: z.string().min(1).max(512) });
export const linkGoogleSchema = googleSignInSchema;
export const linkAppleSchema = z.object({ identityToken: z.string().min(1).max(4096) });
export { username as usernameSchema };

export type RegisterStartInput = z.infer<typeof registerStartSchema>;
export type RegisterVerifyInput = z.infer<typeof registerVerifySchema>;
export type RegisterCompleteInput = z.infer<typeof registerCompleteSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PhoneStartInput = z.infer<typeof phoneStartSchema>;
export type PhoneVerifyInput = z.infer<typeof phoneVerifySchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;
export type AppleSignInInput = z.infer<typeof appleSignInSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
