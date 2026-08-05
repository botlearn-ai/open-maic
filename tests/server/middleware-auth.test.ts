import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from '@/middleware';
import { createAccessToken } from '@/lib/server/access-token';

const BASE_URL = 'http://localhost:3000';

function makeRequest(path: string, init?: { headers?: Record<string, string> }): NextRequest {
  return new NextRequest(`${BASE_URL}${path}`, { headers: init?.headers });
}

describe('access-code middleware', () => {
  afterEach(() => {
    delete process.env.ACCESS_CODE;
  });

  it('lets all requests through when ACCESS_CODE is not set', async () => {
    const response = await middleware(makeRequest('/api/generate-classroom'));
    expect(response.status).toBe(200);
  });

  describe('with ACCESS_CODE set', () => {
    const ACCESS_CODE = 'test-access-code';

    it('rejects API requests without credentials', async () => {
      process.env.ACCESS_CODE = ACCESS_CODE;
      const response = await middleware(makeRequest('/api/generate-classroom'));
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toMatchObject({ success: false, errorCode: 'INVALID_REQUEST' });
    });

    it('accepts the raw access code as a Bearer token', async () => {
      process.env.ACCESS_CODE = ACCESS_CODE;
      const response = await middleware(
        makeRequest('/api/generate-classroom', {
          headers: { authorization: `Bearer ${ACCESS_CODE}` },
        }),
      );
      expect(response.status).toBe(200);
    });

    it('accepts a signed HMAC token as a Bearer token', async () => {
      process.env.ACCESS_CODE = ACCESS_CODE;
      const response = await middleware(
        makeRequest('/api/generate-classroom', {
          headers: { authorization: `Bearer ${createAccessToken(ACCESS_CODE)}` },
        }),
      );
      expect(response.status).toBe(200);
    });

    it('rejects an incorrect Bearer token', async () => {
      process.env.ACCESS_CODE = ACCESS_CODE;
      const response = await middleware(
        makeRequest('/api/generate-classroom', {
          headers: { authorization: 'Bearer wrong-code' },
        }),
      );
      expect(response.status).toBe(401);
    });

    it('rejects a malformed Authorization header', async () => {
      process.env.ACCESS_CODE = ACCESS_CODE;
      const response = await middleware(
        makeRequest('/api/generate-classroom', {
          headers: { authorization: ACCESS_CODE },
        }),
      );
      expect(response.status).toBe(401);
    });

    it('still accepts a valid signed cookie', async () => {
      process.env.ACCESS_CODE = ACCESS_CODE;
      const request = makeRequest('/api/generate-classroom');
      request.cookies.set('openmaic_access', createAccessToken(ACCESS_CODE));
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('rejects a cookie signed with a different access code', async () => {
      process.env.ACCESS_CODE = ACCESS_CODE;
      const request = makeRequest('/api/generate-classroom');
      request.cookies.set('openmaic_access', createAccessToken('other-code'));
      const response = await middleware(request);
      expect(response.status).toBe(401);
    });

    it('lets whitelisted endpoints through without credentials', async () => {
      process.env.ACCESS_CODE = ACCESS_CODE;
      const health = await middleware(makeRequest('/api/health'));
      expect(health.status).toBe(200);
      const verify = await middleware(makeRequest('/api/access-code/verify'));
      expect(verify.status).toBe(200);
    });

    it('lets page requests through so the frontend can show the access modal', async () => {
      process.env.ACCESS_CODE = ACCESS_CODE;
      const response = await middleware(makeRequest('/classroom/abc123'));
      expect(response.status).toBe(200);
    });
  });
});
