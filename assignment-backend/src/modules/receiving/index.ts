import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../../db';
import { recordReceiptsSchema } from '../../validation';
import { ConflictError, NotFoundError, ValidationError } from '../../errors/AppError';
import { addHistoryEntry } from '../timeline';

export const recordReceiptsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const parseResult = recordReceiptsSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0].message);
    }
    const { receipts } = parseResult.data;

    const result = await withTransaction(async (client) => {
      const reqResult = await client.query('SELECT * FROM requisitions WHERE id = $1 FOR UPDATE', [id]);
      if (reqResult.rows.length === 0) {
        throw new NotFoundError('Requisition not found');
      }

      const requisition = reqResult.rows[0];
      if (requisition.status !== 'Ordered') {
        throw new ConflictError(`Receipts can only be recorded for requisitions in 'Ordered' status (current status: '${requisition.status}')`);
      }

      for (const receipt of receipts) {
        const lineResult = await client.query(
          'SELECT * FROM line_items WHERE id = $1 AND requisition_id = $2 FOR UPDATE',
          [receipt.line_item_id, id]
        );

        if (lineResult.rows.length === 0) {
          throw new ConflictError(`Line item ${receipt.line_item_id} does not belong to requisition ${id}`);
        }

        const line = lineResult.rows[0];
        const newReceivedQty = line.received_quantity + receipt.quantity_received;

        if (newReceivedQty > line.ordered_quantity) {
          throw new ConflictError(
            `Recording receipt of ${receipt.quantity_received} units on item '${line.description}' would exceed ordered quantity (${newReceivedQty} > ${line.ordered_quantity})`
          );
        }

        await client.query(
          'UPDATE line_items SET received_quantity = $1 WHERE id = $2',
          [newReceivedQty, receipt.line_item_id]
        );

        // Record history event for receipt
        await addHistoryEntry({
          requisition_id: id,
          event_type: 'receipt',
          actor_id: user.id,
          details: {
            line_item_id: receipt.line_item_id,
            description: line.description,
            quantity_received: receipt.quantity_received,
            total_received: newReceivedQty,
            ordered_quantity: line.ordered_quantity,
          },
          client,
        });
      }

      // Check if all lines are fully received
      const allLinesResult = await client.query(
        'SELECT ordered_quantity, received_quantity FROM line_items WHERE requisition_id = $1',
        [id]
      );

      const allComplete = allLinesResult.rows.every(
        (l) => l.received_quantity === l.ordered_quantity
      );

      let updatedStatus = 'Ordered';
      if (allComplete) {
        updatedStatus = 'Received';
        await client.query(
          "UPDATE requisitions SET status = 'Received', updated_at = now() WHERE id = $1",
          [id]
        );

        await addHistoryEntry({
          requisition_id: id,
          event_type: 'status_change',
          actor_id: user.id,
          old_status: 'Ordered',
          new_status: 'Received',
          client,
        });
      } else {
        await client.query('UPDATE requisitions SET updated_at = now() WHERE id = $1', [id]);
      }

      const updatedReq = (await client.query('SELECT * FROM requisitions WHERE id = $1', [id])).rows[0];
      const updatedLines = (await client.query('SELECT * FROM line_items WHERE requisition_id = $1 ORDER BY id ASC', [id])).rows;

      return {
        requisition: updatedReq,
        line_items: updatedLines,
        is_complete: allComplete,
      };
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};
