import { Request, Response, NextFunction } from 'express';
import { query } from '../../db';
import { assignApproverSchema } from '../../validation';
import { ConflictError, NotFoundError, ValidationError } from '../../errors/AppError';

export const listAssignedApproversHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const reqCheck = await query('SELECT id FROM requisitions WHERE id = $1', [id]);
    if (reqCheck.rows.length === 0) {
      throw new NotFoundError('Requisition not found');
    }

    const sql = `
      SELECT 
        aa.approver_id,
        p.email,
        aa.assigned_at
      FROM requisition_assigned_approvers aa
      JOIN profiles p ON aa.approver_id = p.id
      WHERE aa.requisition_id = $1
      ORDER BY aa.assigned_at ASC
    `;
    const result = await query(sql, [id]);
    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const assignApproverHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const reqCheck = await query('SELECT id FROM requisitions WHERE id = $1', [id]);
    if (reqCheck.rows.length === 0) {
      throw new NotFoundError('Requisition not found');
    }

    const parseResult = assignApproverSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0].message);
    }
    const { approver_id } = parseResult.data;

    // Check target user is an approver
    const approverCheck = await query("SELECT id, role FROM profiles WHERE id = $1 AND role = 'approver'", [approver_id]);
    if (approverCheck.rows.length === 0) {
      throw new ValidationError('Target user is not an approver');
    }

    // Insert junction row
    const sql = `
      INSERT INTO requisition_assigned_approvers (requisition_id, approver_id)
      VALUES ($1, $2)
      ON CONFLICT (requisition_id, approver_id) DO NOTHING
      RETURNING *
    `;
    const result = await query(sql, [id, approver_id]);

    if (result.rows.length === 0) {
      throw new ConflictError('Approver is already assigned to this requisition');
    }

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const removeAssignedApproverHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, approverId } = req.params;

    const result = await query(
      'DELETE FROM requisition_assigned_approvers WHERE requisition_id = $1 AND approver_id = $2 RETURNING *',
      [id, approverId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Approver assignment not found on this requisition');
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};
