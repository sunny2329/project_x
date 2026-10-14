import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit.js';

function appWith(limit: number, key?: (req: express.Request) => string) {
  const app = express();
  app.use(express.json());
  app.post('/', createRateLimiter({ name: 't', windowMs: 60_000, limit, ...(key ? { key } : {}) }, true), (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('createRateLimiter', () => {
  it('returns the standard error shape once the limit is exceeded', async () => {
    const app = appWith(2);
    await request(app).post('/').expect(200);
    await request(app).post('/').expect(200);
    const res = await request(app).post('/').expect(429);
    expect(res.body).toEqual({ success: false, error: { code: 'RATE_LIMITED', message: expect.any(String) } });
  });

  it('counts each target separately when keyed by target', async () => {
    const app = appWith(1, (req) => String(req.body.phone));
    await request(app).post('/').send({ phone: '+911' }).expect(200);
    await request(app).post('/').send({ phone: '+911' }).expect(429);
    await request(app).post('/').send({ phone: '+912' }).expect(200);
  });
});
