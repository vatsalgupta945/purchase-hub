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

  describe('GET /api/dashboard', () => {
    it('returns awaiting_approval and overdue_count for approver', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // awaiting_approval
        .mockResolvedValueOnce({ rows: [{ total_value: '1500.00' }] }) // open_commitments
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // overdue_count
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // received_last_7_days
        .mockResolvedValueOnce({ rows: [{ status: 'Submitted', count: '3' }] }) // by_status
        .mockResolvedValueOnce({ rows: [{ department: 'Engineering', count: '3' }] }) // by_department
        .mockResolvedValueOnce({ rows: [{ week_start: '2026-09-01', count: '1' }] }); // received_per_week

      const res = await request(app)
        .get('/api/dashboard')
        .set('x-test-user-id', 'appr-1')
        .set('x-test-user-role', 'approver');

      expect(res.status).toBe(200);
      expect(res.body.awaiting_approval).toBe(3);
      expect(res.body.overdue_count).toBe(2);
      expect(res.body.open_commitments_value).toBe('1500.00');
    });
  });

  describe('GET /api/alerts & POST /api/alerts/:id/dismiss', () => {
    it('returns overdue alerts list for approvers', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'req-overdue-1',
            title: 'Overdue Server Parts',
            status: 'Submitted',
            needed_by: '2026-08-15',
            total: '2400.00',
          },
        ],
      });

      const res = await request(app)
        .get('/api/alerts')
        .set('x-test-user-id', 'appr-1')
        .set('x-test-user-role', 'approver');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].id).toBe('req-overdue-1');
      expect(res.body.data[0].status).toBe('Submitted');
    });

    it('allows an approver to dismiss an alert snapshotting needed_by', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'req-1', needed_by: '2026-08-15', status: 'Submitted' }] }) // req check
        .mockResolvedValueOnce({ rows: [{ requisition_id: 'req-1', approver_id: 'appr-1', dismissed_needed_by: '2026-08-15' }] }); // insert dismissal

      const res = await request(app)
        .post('/api/alerts/req-1/dismiss')
        .set('x-test-user-id', 'appr-1')
        .set('x-test-user-role', 'approver');

      expect(res.status).toBe(201);
      expect(res.body.dismissed_needed_by).toBe('2026-08-15');
    });
  });

  describe('GET /api/requisitions sorting by created_at', () => {
    it('queries requisitions sorted by created_at DESC by default', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total_count: '1' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'req-1',
              title: 'Test Req',
              status: 'Draft',
              total: '100.00',
              created_at: '2026-09-01T00:00:00Z',
            },
          ],
        });

      const res = await request(app)
        .get('/api/requisitions?sort_by=created_at&sort_dir=desc')
        .set('x-test-user-id', 'req-user-1')
        .set('x-test-user-role', 'requester');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('GET /api/requisitions/:id/timeline', () => {
    it('returns history entries with new_status and rejection reasons', async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'req-1' }] }) // req check
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'hist-1',
              requisition_id: 'req-1',
              event_type: 'status_change',
              old_status: 'Submitted',
              new_status: 'Rejected',
              reason: 'Over budget cap for Q3',
              actor_id: 'appr-1',
              actor_email: 'approver@example.com',
              created_at: '2026-09-05T12:00:00Z',
            },
          ],
        });

      const res = await request(app)
        .get('/api/requisitions/req-1/timeline')
        .set('x-test-user-id', 'req-user-1')
        .set('x-test-user-role', 'requester');

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].event_type).toBe('status_change');
      expect(res.body[0].new_status).toBe('Rejected');
      expect(res.body[0].reason).toBe('Over budget cap for Q3');
    });
  });
});
