import { Request, Response, NextFunction } from 'express';
import { query } from '../../db';
import { ConflictError, NotFoundError } from '../../errors/AppError';

export const getMeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    if (!user) {
      throw new NotFoundError('User profile not found');
    }
    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      approval_limit: user.approval_limit,
      monthly_approval_limit: user.monthly_approval_limit ?? user.approval_limit,
      used_this_month: user.used_this_month ?? 0,
      remaining_monthly_limit: user.remaining_monthly_limit ?? user.approval_limit,
      reports_to_id: user.reports_to_id ?? null,
      reports_to_email: user.reports_to_email ?? null,
      department: user.department ?? null,
      title: user.title ?? null,
    });
  } catch (error) {
    next(error);
  }
};

export const getHierarchyHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sql = `
      SELECT 
        p.id, p.email, p.role, p.approval_limit, p.reports_to_id, p.department, p.title,
        manager.email as reports_to_email,
        manager.title as reports_to_title,
        COALESCE((
          SELECT SUM(li.ordered_quantity * li.unit_price)
          FROM requisition_history h
          JOIN line_items li ON li.requisition_id = h.requisition_id
          WHERE h.actor_id = p.id 
            AND h.event_type = 'status_change' 
            AND h.new_status = 'Approved'
            AND DATE_TRUNC('month', h.created_at) = DATE_TRUNC('month', CURRENT_DATE)
        ), 0)::NUMERIC(12,2) as used_this_month
      FROM profiles p
      LEFT JOIN profiles manager ON p.reports_to_id = manager.id
      ORDER BY p.role DESC, COALESCE(p.approval_limit, 0) DESC
    `;
    const result = await query(sql);
    const data = result.rows.map((row) => {
      const limit = row.approval_limit !== null ? parseFloat(row.approval_limit) : null;
      const used = parseFloat(row.used_this_month || '0');
      const remaining = limit !== null ? Math.max(0, limit - used) : null;
      return {
        ...row,
        approval_limit: limit,
        used_this_month: used,
        remaining_monthly_limit: remaining,
      };
    });
    return res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const createProfileHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    if (!user) {
      throw new NotFoundError('User profile context not found');
    }

    const check = await query('SELECT id FROM profiles WHERE id = $1', [user.id]);
    if (check.rows.length > 0) {
      throw new ConflictError('Profile already exists');
    }

    // New self-registrations are always role 'requester'
    const sql = `
      INSERT INTO profiles (id, email, role, approval_limit)
      VALUES ($1, $2, 'requester', NULL)
      RETURNING id, email, role, approval_limit, created_at
    `;
    const result = await query(sql, [user.id, user.email]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};
