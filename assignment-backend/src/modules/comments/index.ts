import { Request, Response, NextFunction } from 'express';
import { query } from '../../db';
import { createCommentSchema } from '../../validation';
import { ForbiddenError, NotFoundError, ValidationError } from '../../errors/AppError';
import { addHistoryEntry } from '../timeline';

export const createCommentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const parseResult = createCommentSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0].message);
    }
    const { body } = parseResult.data;

    const reqResult = await query('SELECT owner_id FROM requisitions WHERE id = $1', [id]);
    if (reqResult.rows.length === 0) {
      throw new NotFoundError('Requisition not found');
    }

    const requisition = reqResult.rows[0];

    if (user.role === 'requester' && requisition.owner_id !== user.id) {
      throw new ForbiddenError('Requesters can only comment on their own requisitions');
    }

    const entry = await addHistoryEntry({
      requisition_id: id,
      event_type: 'comment',
      actor_id: user.id,
      details: { body },
    });

    return res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
};
