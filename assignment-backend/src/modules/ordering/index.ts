import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../../db';
import { updateNeededBySchema } from '../../validation';
import { ConflictError, NotFoundError, ValidationError } from '../../errors/AppError';
import { addHistoryEntry } from '../timeline';

export const orderRequisitionHandler = async (
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
      if (requisition.status !== 'Approved') {
        throw new ConflictError(`Cannot mark as Ordered a requisition in '${requisition.status}' status (must be 'Approved')`);
      }

      const updateResult = await client.query(
        "UPDATE requisitions SET status = 'Ordered', updated_at = now() WHERE id = $1 RETURNING *",
        [id]
      );
      const updatedReq = updateResult.rows[0];

      await addHistoryEntry({
        requisition_id: id,
        event_type: 'status_change',
        actor_id: user.id,
        old_status: 'Approved',
        new_status: 'Ordered',
        client,
      });

      return updatedReq;
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const extendNeededByHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const parseResult = updateNeededBySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0].message);
    }
    const { needed_by } = parseResult.data;

    const result = await withTransaction(async (client) => {
      const reqResult = await client.query('SELECT * FROM requisitions WHERE id = $1 FOR UPDATE', [id]);
      if (reqResult.rows.length === 0) {
        throw new NotFoundError('Requisition not found');
      }

      const requisition = reqResult.rows[0];
      if (requisition.status !== 'Ordered') {
        throw new ConflictError(`Needed-by date can only be extended when status is 'Ordered' (current status: '${requisition.status}')`);
      }

      const oldNeededBy = requisition.needed_by;

      const updateResult = await client.query(
        'UPDATE requisitions SET needed_by = $1, updated_at = now() WHERE id = $2 RETURNING *',
        [needed_by, id]
      );
      const updatedReq = updateResult.rows[0];

      await addHistoryEntry({
        requisition_id: id,
        event_type: 'comment',
        actor_id: user.id,
        details: {
          action: 'extend_needed_by',
          old_needed_by: oldNeededBy,
          new_needed_by: needed_by,
        },
        client,
      });

      return updatedReq;
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};
