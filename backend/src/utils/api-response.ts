import type { Response } from 'express';
import type { ErrorDetails } from './app-error.js';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: ErrorDetails };
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const body: ApiSuccess<T> = { success: true, data };
  res.status(statusCode).json(body);
}

export function sendFailure(res: Response, statusCode: number, error: ApiFailure['error']): void {
  const body: ApiFailure = { success: false, error };
  res.status(statusCode).json(body);
}
