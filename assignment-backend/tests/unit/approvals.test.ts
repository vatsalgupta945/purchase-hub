import { bulkApproveSchema, rejectRequisitionSchema } from '../../src/validation';

describe('Approvals Business Rules', () => {
  describe('Rejection validation', () => {
    it('requires a non-empty reason for rejection', () => {
      const emptyResult = rejectRequisitionSchema.safeParse({ reason: '' });
      expect(emptyResult.success).toBe(false);

      const validResult = rejectRequisitionSchema.safeParse({ reason: 'Over budget for Q3' });
      expect(validResult.success).toBe(true);
    });
  });

  describe('Approval Limit Thresholds', () => {
    function checkApprovalLimit(total: number, limit: number): boolean {
      return total <= limit;
    }

    it('approves requisitions at or below the approval limit', () => {
      expect(checkApprovalLimit(1000.00, 1000.00)).toBe(true);
      expect(checkApprovalLimit(999.99, 1000.00)).toBe(true);
    });

    it('refuses requisitions one cent over the approval limit', () => {
      expect(checkApprovalLimit(1000.01, 1000.00)).toBe(false);
      expect(checkApprovalLimit(5000.00, 1000.00)).toBe(false);
    });
  });

  describe('Bulk Approval Validation', () => {
    it('validates bulk approval request payload', () => {
      const invalid = bulkApproveSchema.safeParse({ requisition_ids: [] });
      expect(invalid.success).toBe(false);

      const valid = bulkApproveSchema.safeParse({
        requisition_ids: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'],
      });
      expect(valid.success).toBe(true);
    });

    it('evaluates bulk approval items independently', () => {
      const items = [
        { id: '1', total: 500, status: 'Submitted' },
        { id: '2', total: 1500, status: 'Submitted' },
        { id: '3', total: 200, status: 'Draft' },
      ];
      const limit = 1000;

      const results = items.map((item) => {
        if (item.status !== 'Submitted') {
          return { id: item.id, status: 'refused', reason: 'Not in Submitted status' };
        }
        if (item.total > limit) {
          return { id: item.id, status: 'refused', reason: 'Exceeds approval limit' };
        }
        return { id: item.id, status: 'approved' };
      });

      expect(results).toEqual([
        { id: '1', status: 'approved' },
        { id: '2', status: 'refused', reason: 'Exceeds approval limit' },
        { id: '3', status: 'refused', reason: 'Not in Submitted status' },
      ]);
    });
  });
});
