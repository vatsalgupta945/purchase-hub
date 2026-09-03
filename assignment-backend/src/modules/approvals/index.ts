import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../../db';
import { bulkApproveSchema, rejectRequisitionSchema } from '../../validation';
import { ConflictError, NotFoundError, ValidationError } from '../../errors/AppError';
import { addHistoryEntry } from '../timeline';

export const approveRequisitionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const result = await withTransaction(async (client) => {
      const reqResult = await client.query('SELECT * FROM requisitions WHERE id = $1 FOR UPDATE', [id]);
      if (reqResult.rows.length === 0) {
        throw new NotFoundError('Requisition not found');
      }

      const requisition = reqResult.rows[0];
      if (requisition.status !== 'Submitted') {
        throw new ConflictError(`Cannot approve a requisition that is in '${requisition.status}' status (must be 'Submitted')`);
      }

      // Compute total
      const totalResult = await client.query(
        'SELECT COALESCE(SUM(ordered_quantity * unit_price), 0)::NUMERIC(12,2) as total FROM line_items WHERE requisition_id = $1',
        [id]
      );
      const total = parseFloat(totalResult.rows[0].total);

      // Calculate current user's used amount this month inside transaction
      const monthUsedResult = await client.query(
        `SELECT COALESCE(SUM(li.ordered_quantity * li.unit_price), 0)::NUMERIC(12,2) as used
         FROM requisition_history h
         JOIN line_items li ON li.requisition_id = h.requisition_id
         WHERE h.actor_id = $1 
           AND h.event_type = 'status_change' 
           AND h.new_status = 'Approved'
           AND DATE_TRUNC('month', h.created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
        [user.id]
      );
      const usedThisMonth = parseFloat(monthUsedResult.rows[0].used);
      const rawLimit = user.approval_limit;
      const userLimit = (rawLimit !== null && rawLimit !== undefined && !Number.isNaN(Number(rawLimit)))
        ? Number(rawLimit)
        : 0;
      const remainingLimit = Math.max(0, userLimit - usedThisMonth);

      if (total > remainingLimit) {
        throw new ConflictError(
          `Requisition total ($${total.toFixed(2)}) exceeds your remaining monthly approval limit ($${remainingLimit.toFixed(2)} available of $${userLimit.toFixed(2)} monthly limit).`,
          'LIMIT_EXCEEDED'
        );
      }

      // Update status to Approved
      const updateResult = await client.query(
        "UPDATE requisitions SET status = 'Approved', updated_at = now() WHERE id = $1 RETURNING *",
        [id]
      );
      const updatedReq = updateResult.rows[0];

      // Record timeline history
      await addHistoryEntry({
        requisition_id: id,
        event_type: 'status_change',
        actor_id: user.id,
        old_status: 'Submitted',
        new_status: 'Approved',
        client,
      });

      return {
        ...updatedReq,
        total: total.toFixed(2),
      };
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const rejectRequisitionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const parseResult = rejectRequisitionSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0].message);
    }
    const { reason } = parseResult.data;

    const result = await withTransaction(async (client) => {
      const reqResult = await client.query('SELECT * FROM requisitions WHERE id = $1 FOR UPDATE', [id]);
      if (reqResult.rows.length === 0) {
        throw new NotFoundError('Requisition not found');
      }

      const requisition = reqResult.rows[0];
      if (requisition.status !== 'Submitted') {
        throw new ConflictError(`Cannot reject a requisition that is in '${requisition.status}' status (must be 'Submitted')`);
      }

      // Update status to Rejected
      const updateResult = await client.query(
        "UPDATE requisitions SET status = 'Rejected', updated_at = now() WHERE id = $1 RETURNING *",
        [id]
      );
      const updatedReq = updateResult.rows[0];

      // Record timeline history entry with reason
      await addHistoryEntry({
        requisition_id: id,
        event_type: 'status_change',
        actor_id: user.id,
        old_status: 'Submitted',
        new_status: 'Rejected',
        reason,
        client,
      });

      return updatedReq;
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const escalateRequisitionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const result = await withTransaction(async (client) => {
      const reqResult = await client.query('SELECT * FROM requisitions WHERE id = $1 FOR UPDATE', [id]);
      if (reqResult.rows.length === 0) {
        throw new NotFoundError('Requisition not found');
      }

      const requisition = reqResult.rows[0];
      if (requisition.status !== 'Submitted') {
        throw new ConflictError(`Cannot escalate a requisition in '${requisition.status}' status (must be 'Submitted')`);
      }

      // Find senior manager/approver in hierarchy
      const userResult = await client.query(
        `SELECT p.reports_to_id, manager.email as manager_email, manager.title as manager_title
         FROM profiles p
         LEFT JOIN profiles manager ON p.reports_to_id = manager.id
         WHERE p.id = $1`,
        [user.id]
      );

      const reportsToId = userResult.rows[0]?.reports_to_id;
      const managerEmail = userResult.rows[0]?.manager_email || 'Senior Manager';

      if (!reportsToId) {
        throw new ConflictError('No senior manager assigned to escalate to in the hierarchy');
      }

      // Assign senior approver to requisition
      await client.query(
        `INSERT INTO requisition_assigned_approvers (requisition_id, approver_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, reportsToId]
      );

      // Record timeline history entry
      await addHistoryEntry({
        requisition_id: id,
        event_type: 'comment',
        actor_id: user.id,
        reason: `Escalated requisition to senior manager (${managerEmail}) due to approval limit constraint.`,
        client,
      });

      return {
        escalated: true,
        requisition_id: id,
        escalated_to_id: reportsToId,
        escalated_to_email: managerEmail,
      };
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const bulkApproveHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user!;
    const parseResult = bulkApproveSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0].message);
    }

    const { requisition_ids } = parseResult.data;
    const rawLimit = user.approval_limit;
    const userLimit = (rawLimit !== null && rawLimit !== undefined && !Number.isNaN(Number(rawLimit)))
      ? Number(rawLimit)
      : 0;
    const results: Array<{ id: string; status: 'approved' | 'refused'; reason?: string }> = [];

    for (const reqId of requisition_ids) {
      try {
        await withTransaction(async (client) => {
          const reqResult = await client.query('SELECT * FROM requisitions WHERE id = $1 FOR UPDATE', [reqId]);
          if (reqResult.rows.length === 0) {
            results.push({ id: reqId, status: 'refused', reason: 'Requisition not found' });
            return;
          }

          const requisition = reqResult.rows[0];
          if (requisition.status !== 'Submitted') {
            results.push({
              id: reqId,
              status: 'refused',
              reason: `Not in Submitted status (current: '${requisition.status}')`,
            });
            return;
          }

          const totalResult = await client.query(
            'SELECT COALESCE(SUM(ordered_quantity * unit_price), 0)::NUMERIC(12,2) as total FROM line_items WHERE requisition_id = $1',
            [reqId]
          );
          const total = parseFloat(totalResult.rows[0].total);

          const monthUsedResult = await client.query(
            `SELECT COALESCE(SUM(li.ordered_quantity * li.unit_price), 0)::NUMERIC(12,2) as used
             FROM requisition_history h
             JOIN line_items li ON li.requisition_id = h.requisition_id
             WHERE h.actor_id = $1 
               AND h.event_type = 'status_change' 
               AND h.new_status = 'Approved'
               AND DATE_TRUNC('month', h.created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
            [user.id]
          );
          const usedThisMonth = parseFloat(monthUsedResult.rows[0].used);
          const remainingLimit = Math.max(0, userLimit - usedThisMonth);

          if (total > remainingLimit) {
            results.push({
              id: reqId,
              status: 'refused',
              reason: `Exceeds remaining monthly limit ($${total.toFixed(2)} > $${remainingLimit.toFixed(2)})`,
            });
            return;
          }

          await client.query(
            "UPDATE requisitions SET status = 'Approved', updated_at = now() WHERE id = $1",
            [reqId]
          );

          await addHistoryEntry({
            requisition_id: reqId,
            event_type: 'status_change',
            actor_id: user.id,
            old_status: 'Submitted',
            new_status: 'Approved',
            client,
          });

          results.push({ id: reqId, status: 'approved' });
        });
      } catch (err: any) {
        results.push({ id: reqId, status: 'refused', reason: err.message || 'Error approving requisition' });
      }
    }

    return res.json({ results });
  } catch (error) {
    next(error);
  }
};
