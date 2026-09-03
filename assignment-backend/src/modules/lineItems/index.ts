import { Request, Response, NextFunction } from 'express';
import { query } from '../../db';
import { createLineItemSchema, updateLineItemSchema } from '../../validation';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors/AppError';

async function verifyDraftOwnership(requisitionId: string, userId: string) {
  const reqResult = await query('SELECT owner_id, status FROM requisitions WHERE id = $1', [requisitionId]);
  if (reqResult.rows.length === 0) {
    throw new NotFoundError('Requisition not found');
  }
  const requisition = reqResult.rows[0];
  if (requisition.owner_id !== userId) {
    throw new ForbiddenError('Only the requisition owner can modify line items');
  }
  if (requisition.status !== 'Draft' && requisition.status !== 'Rejected') {
    throw new ConflictError(`Line items can only be modified when requisition is in Draft or Rejected status (current status: '${requisition.status}')`);
  }
}

export const createLineItemHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    await verifyDraftOwnership(id, user.id);

    const parseResult = createLineItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0].message);
    }
    const { description, ordered_quantity, unit_price } = parseResult.data;

    const sql = `
      INSERT INTO line_items (requisition_id, description, ordered_quantity, unit_price, received_quantity)
      VALUES ($1, $2, $3, $4, 0)
      RETURNING *
    `;
    const result = await query(sql, [id, description, ordered_quantity, unit_price]);
    const lineItem = result.rows[0];

    return res.status(201).json({
      ...lineItem,
      unit_price: lineItem.unit_price.toString(),
    });
  } catch (error) {
    next(error);
  }
};

export const updateLineItemHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, lineId } = req.params;
    const user = req.user!;

    await verifyDraftOwnership(id, user.id);

    const parseResult = updateLineItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0].message);
    }

    const checkLine = await query('SELECT * FROM line_items WHERE id = $1 AND requisition_id = $2', [lineId, id]);
    if (checkLine.rows.length === 0) {
      throw new NotFoundError('Line item not found on this requisition');
    }
    const existing = checkLine.rows[0];

    const updates = parseResult.data;
    const description = updates.description ?? existing.description;
    const ordered_quantity = updates.ordered_quantity ?? existing.ordered_quantity;
    const unit_price = updates.unit_price ?? existing.unit_price;

    const sql = `
      UPDATE line_items
      SET description = $1, ordered_quantity = $2, unit_price = $3
      WHERE id = $4 AND requisition_id = $5
      RETURNING *
    `;
    const result = await query(sql, [description, ordered_quantity, unit_price, lineId, id]);
    const updated = result.rows[0];

    return res.json({
      ...updated,
      unit_price: updated.unit_price.toString(),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLineItemHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, lineId } = req.params;
    const user = req.user!;

    await verifyDraftOwnership(id, user.id);

    const result = await query('DELETE FROM line_items WHERE id = $1 AND requisition_id = $2 RETURNING id', [lineId, id]);
    if (result.rows.length === 0) {
      throw new NotFoundError('Line item not found on this requisition');
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};
