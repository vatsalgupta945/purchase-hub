import { Request, Response, NextFunction } from 'express';
import { query } from '../../db';
import { NotFoundError } from '../../errors/AppError';

export interface HistoryEntryInput {
  requisition_id: string;
  event_type: 'created' | 'status_change' | 'receipt' | 'comment';
  actor_id: string;
  old_status?: string | null;
  new_status?: string | null;
  reason?: string | null;
  details?: Record<string, any> | null;
  client?: any; // optional db client for transactional writes
}

export async function addHistoryEntry(input: HistoryEntryInput) {
  const q = input.client ? input.client.query.bind(input.client) : query;
  const sql = `
    INSERT INTO requisition_history (
      requisition_id, event_type, actor_id, old_status, new_status, reason, details
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const values = [
    input.requisition_id,
    input.event_type,
    input.actor_id,
    input.old_status || null,
    input.new_status || null,
    input.reason || null,
    input.details ? JSON.stringify(input.details) : null,
  ];
  const result = await q(sql, values);
  return result.rows[0];
}

export const getTimelineHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    // Check requisition existence
    const reqCheck = await query('SELECT id FROM requisitions WHERE id = $1', [id]);
    if (reqCheck.rows.length === 0) {
      throw new NotFoundError('Requisition not found');
    }

    const sql = `
      SELECT 
        h.id,
        h.requisition_id,
        h.event_type,
        h.actor_id,
        p.email as actor_email,
        p.role as actor_role,
        h.old_status,
        h.new_status,
        h.reason,
        h.details,
        h.created_at
      FROM requisition_history h
      JOIN profiles p ON h.actor_id = p.id
      WHERE h.requisition_id = $1
      ORDER BY h.created_at ASC
    `;
    const result = await query(sql, [id]);
    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};
