import request from 'supertest';
import app from '../../src/app';
import * as db from '../../src/db';

jest.mock('../../src/db', () => {
  const original = jest.requireActual('../../src/db');
  return {
    ...original,
    query: jest.fn(),
    withTransaction: jest.fn((cb) => cb({ query: jest.fn() })),
  };
});

describe('Procurement API Endpoints Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('returns 200 ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Authorization & Role Enforcement', () => {
    it('returns 401 Unauthorized when Bearer token is missing', async () => {
      const res = await request(app).get('/api/requisitions');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 Forbidden when a Requester tries to hit an Approver endpoint', async () => {
      const res = await request(app)
        .post('/api/requisitions/11111111-1111-1111-1111-111111111111/approve')
        .set('x-test-user-id', 'req-user-1')
        .set('x-test-user-role', 'requester');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 403 Forbidden when an Approver tries to create a Requisition', async () => {
      const res = await request(app)
        .post('/api/requisitions')
        .set('x-test-user-id', 'appr-user-1')
        .set('x-test-user-role', 'approver')
        .send({
          title: 'Test Req',
          vendor_name: 'Test Vendor',
          department: 'Engineering',
          needed_by: '2026-10-01',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/me & GET /api/approvers/hierarchy', () => {
    it('returns profile of current user including monthly limit', async () => {
      const res = await request(app)
        .get('/api/me')
        .set('x-test-user-id', 'user-100')
        .set('x-test-user-role', 'approver')
        .set('x-test-user-limit', '5000')
        .set('x-test-user-email', 'approver@example.com');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          id: 'user-100',
          email: 'approver@example.com',
          role: 'approver',
          approval_limit: 5000,
          monthly_approval_limit: 5000,
          remaining_monthly_limit: 5000,
          used_this_month: 0,
        })
      );
    });

    it('returns company hierarchy tree', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/approvers/hierarchy')
        .set('x-test-user-id', 'user-100')
        .set('x-test-user-role', 'approver');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
