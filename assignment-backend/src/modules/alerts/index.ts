import { Request, Response, NextFunction } from 'express';
import { query } from '../../db';
import { ForbiddenError, NotFoundError } from '../../errors/AppError';

export const listAlertsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user!;

    const sql = `
      SELECT 
        r.*,
        p.email as owner_email,
        COALESCE(SUM(li.ordered_quantity * li.unit_price), 0)::NUMERIC(12,2) as total
      FROM requisitions r
      JOIN profiles p ON r.owner_id = p.id
      LEFT JOIN line_items li ON r.id = li.requisition_id
      JOIN requisition_assigned_approvers aa ON aa.requisition_id = r.id AND aa.approver_id = $1
      WHERE r.status = 'Ordered'
        AND r.needed_by < CURRENT_DATE
        AND EXISTS (
          SELECT 1 FROM line_items sub_li 
          WHERE sub_li.requisition_id = r.id AND sub_li.received_quantity < sub_li.ordered_quantity
        )
        AND NOT EXISTS (
          SELECT 1 FROM alert_dismissals ad
          WHERE ad.requisition_id = r.id 
            AND ad.approver_id = $1
            AND ad.dismissed_needed_by = r.needed_by
        )
      GROUP BY r.id, p.email
      ORDER BY r.needed_by ASC
    `;

    const result = await query(sql, [user.id]);
    const items = result.rows.map((row) => ({
      ...row,
      total: row.total.toString(),
      is_overdue: true,
    }));

    return res.json({
      data: items,
      count: items.length,
    });
  } catch (error) {
    next(error);
  }
};

export const dismissAlertHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { requisitionId } = req.params;
    const user = req.user!;

    const reqResult = await query('SELECT id, needed_by, status FROM requisitions WHERE id = $1', [requisitionId]);
    if (reqResult.rows.length === 0) {
      throw new NotFoundError('Requisition not found');
    }

    const requisition = reqResult.rows[0];

    // Check assignment
    const assignmentCheck = await query(
      'SELECT 1 FROM requisition_assigned_approvers WHERE requisition_id = $1 AND approver_id = $2',
      [requisitionId, user.id]
    );

    if (assignmentCheck.rows.length === 0) {
      throw new ForbiddenError('You can only dismiss alerts for requisitions assigned to you');
    }

    // Insert or update dismissal record with snapshot of current needed_by
    const sql = `
      INSERT INTO alert_dismissals (requisition_id, approver_id, dismissed_needed_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (requisition_id, approver_id) 
      DO UPDATE SET dismissed_needed_by = EXCLUDED.dismissed_needed_by, dismissed_at = now()
      RETURNING *
    `;

    const result = await query(sql, [requisitionId, user.id, requisition.needed_by]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};
