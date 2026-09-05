import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../../db';
import { createRequisitionSchema, updateRequisitionSchema } from '../../validation';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors/AppError';
import { addHistoryEntry } from '../timeline';

export const createRequisitionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parseResult = createRequisitionSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0].message);
    }
    const { title, vendor_name, department, needed_by } = parseResult.data;
    const owner_id = req.user!.id;

    const requisition = await withTransaction(async (client) => {
      const sql = `
        INSERT INTO requisitions (owner_id, title, vendor_name, department, needed_by, status)
        VALUES ($1, $2, $3, $4, $5, 'Draft')
        RETURNING *
      `;
      const result = await client.query(sql, [owner_id, title, vendor_name, department, needed_by]);
      const createdReq = result.rows[0];

      // Add timeline entry
      await addHistoryEntry({
        requisition_id: createdReq.id,
        event_type: 'created',
        actor_id: owner_id,
        client,
      });

      return createdReq;
    });

    return res.status(201).json({
      ...requisition,
      total: '0.00',
      is_overdue: false,
      line_items: [],
    });
  } catch (error) {
    next(error);
  }
};

export const listRequisitionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user!;
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const department = (req.query.department as string) || '';
    const requestedOwnerId = (req.query.owner_id as string) || '';
    const overdueFilter = req.query.overdue === 'true';
    const assignedToMeFilter = req.query.assigned_to_me === 'true';
    const sortBy = (req.query.sort_by as string) || 'needed_by';
    const sortDir = (req.query.sort_dir as string)?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size as string || '20', 10)));
    const offset = (page - 1) * pageSize;

    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Requester role scoping
    if (user.role === 'requester') {
      whereConditions.push(`r.owner_id = $${paramIndex++}`);
      queryParams.push(user.id);
    } else if (requestedOwnerId) {
      whereConditions.push(`r.owner_id = $${paramIndex++}`);
      queryParams.push(requestedOwnerId);
    }

    // Per-user archive filtering
    const userArchiveParam = paramIndex++;
    queryParams.push(user.id);

    if (status === 'Archived' || req.query.archived_only === 'true') {
      whereConditions.push(
        `EXISTS (SELECT 1 FROM user_archived_requisitions uar WHERE uar.requisition_id = r.id AND uar.user_id = $${userArchiveParam})`
      );
    } else if (req.query.include_archived === 'true') {
      if (status) {
        whereConditions.push(`r.status = $${paramIndex++}`);
        queryParams.push(status);
      }
    } else {
      whereConditions.push(
        `NOT EXISTS (SELECT 1 FROM user_archived_requisitions uar WHERE uar.requisition_id = r.id AND uar.user_id = $${userArchiveParam})`
      );
      if (status) {
        whereConditions.push(`r.status = $${paramIndex++}`);
        queryParams.push(status);
      }
    }

    if (search && search.trim()) {
      whereConditions.push(
        `(r.title ILIKE $${paramIndex} OR r.vendor_name ILIKE $${paramIndex} OR r.department ILIKE $${paramIndex} OR p.email ILIKE $${paramIndex} OR p.title ILIKE $${paramIndex})`
      );
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (department && department.trim()) {
      whereConditions.push(`r.department ILIKE $${paramIndex++}`);
      queryParams.push(`%${department.trim()}%`);
    }

    if (assignedToMeFilter && user.role === 'approver') {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM requisition_assigned_approvers aa 
        WHERE aa.requisition_id = r.id AND aa.approver_id = $${paramIndex++}
      )`);
      queryParams.push(user.id);
    }

    if (overdueFilter) {
      whereConditions.push(`(
        r.status IN ('Submitted', 'Approved', 'Ordered') AND r.needed_by < CURRENT_DATE AND (
          r.status IN ('Submitted', 'Approved') OR EXISTS (
            SELECT 1 FROM line_items li WHERE li.requisition_id = r.id AND li.received_quantity < li.ordered_quantity
          )
        )
      )`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    let orderByClause = 'r.created_at DESC';
    if (sortBy === 'total') {
      orderByClause = `total ${sortDir}`;
    } else if (sortBy === 'status') {
      orderByClause = `r.status ${sortDir}`;
    } else if (sortBy === 'needed_by') {
      orderByClause = `r.needed_by ${sortDir}`;
    } else if (sortBy === 'created_at' || sortBy === 'created' || sortBy === 'createdAt' || sortBy === 'created_date') {
      orderByClause = `r.created_at ${sortDir}`;
    } else if (sortBy === 'title') {
      orderByClause = `r.title ${sortDir}`;
    } else if (sortBy === 'vendor_name' || sortBy === 'vendor') {
      orderByClause = `r.vendor_name ${sortDir}`;
    } else if (sortBy === 'department') {
      orderByClause = `r.department ${sortDir}`;
    }

    const countSql = `
      SELECT COUNT(DISTINCT r.id) as total_count
      FROM requisitions r
      JOIN profiles p ON r.owner_id = p.id
      ${whereClause}
    `;

    const dataSql = `
      SELECT 
        r.*,
        p.email as owner_email,
        p.title as owner_title,
        p.department as owner_department,
        EXISTS (
          SELECT 1 FROM user_archived_requisitions uar 
          WHERE uar.requisition_id = r.id AND uar.user_id = $${userArchiveParam}
        ) as is_archived,
        (
          SELECT h.reason 
          FROM requisition_history h 
          WHERE h.requisition_id = r.id AND h.new_status = 'Rejected' 
          ORDER BY h.created_at DESC LIMIT 1
        ) as rejection_reason,
        (
          SELECT p_actor.email 
          FROM requisition_history h 
          JOIN profiles p_actor ON h.actor_id = p_actor.id
          WHERE h.requisition_id = r.id AND h.new_status = 'Rejected' 
          ORDER BY h.created_at DESC LIMIT 1
        ) as rejected_by_email,
        (
          SELECT p_actor.title 
          FROM requisition_history h 
          JOIN profiles p_actor ON h.actor_id = p_actor.id
          WHERE h.requisition_id = r.id AND h.new_status = 'Rejected' 
          ORDER BY h.created_at DESC LIMIT 1
        ) as rejected_by_title,
        COALESCE(SUM(li.ordered_quantity * li.unit_price), 0)::NUMERIC(12,2) as total,
        (
          r.status IN ('Submitted', 'Approved', 'Ordered') AND r.needed_by < CURRENT_DATE AND (
            r.status IN ('Submitted', 'Approved') OR EXISTS (
              SELECT 1 FROM line_items sub_li 
              WHERE sub_li.requisition_id = r.id AND sub_li.received_quantity < sub_li.ordered_quantity
            )
          )
        ) as is_overdue
      FROM requisitions r
      JOIN profiles p ON r.owner_id = p.id
      LEFT JOIN line_items li ON r.id = li.requisition_id
      ${whereClause}
      GROUP BY r.id, p.email, p.title, p.department
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const countResult = await query(countSql, queryParams);
    const totalMatches = parseInt(countResult.rows[0]?.total_count || '0', 10);

    const dataParams = [...queryParams, pageSize, offset];
    const dataResult = await query(dataSql, dataParams);

    return res.json({
      data: dataResult.rows.map((row) => ({
        ...row,
        total: row.total.toString(),
        is_overdue: Boolean(row.is_overdue),
        is_archived: Boolean(row.is_archived),
      })),
      total: totalMatches,
      page,
      page_size: pageSize,
    });
  } catch (error) {
    next(error);
  }
};

export const getRequisitionByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const reqSql = `
      SELECT 
        r.*,
        p.email as owner_email,
        p.title as owner_title,
        p.department as owner_department,
        EXISTS (
          SELECT 1 FROM user_archived_requisitions uar 
          WHERE uar.requisition_id = r.id AND uar.user_id = $2
        ) as is_archived,
        (
          SELECT h.reason 
          FROM requisition_history h 
          WHERE h.requisition_id = r.id AND h.new_status = 'Rejected' 
          ORDER BY h.created_at DESC LIMIT 1
        ) as rejection_reason,
        (
          SELECT p_actor.email 
          FROM requisition_history h 
          JOIN profiles p_actor ON h.actor_id = p_actor.id
          WHERE h.requisition_id = r.id AND h.new_status = 'Rejected' 
          ORDER BY h.created_at DESC LIMIT 1
        ) as rejected_by_email,
        (
          SELECT p_actor.title 
          FROM requisition_history h 
          JOIN profiles p_actor ON h.actor_id = p_actor.id
          WHERE h.requisition_id = r.id AND h.new_status = 'Rejected' 
          ORDER BY h.created_at DESC LIMIT 1
        ) as rejected_by_title,
        COALESCE(SUM(li.ordered_quantity * li.unit_price), 0)::NUMERIC(12,2) as total,
        (
          r.status IN ('Submitted', 'Approved', 'Ordered') AND r.needed_by < CURRENT_DATE AND (
            r.status IN ('Submitted', 'Approved') OR EXISTS (
              SELECT 1 FROM line_items sub_li 
              WHERE sub_li.requisition_id = r.id AND sub_li.received_quantity < sub_li.ordered_quantity
            )
          )
        ) as is_overdue
      FROM requisitions r
      JOIN profiles p ON r.owner_id = p.id
      LEFT JOIN line_items li ON r.id = li.requisition_id
      WHERE r.id = $1
      GROUP BY r.id, p.email, p.title, p.department
    `;
    const reqResult = await query(reqSql, [id, user.id]);

    if (reqResult.rows.length === 0) {
      throw new NotFoundError('Requisition not found');
    }

    const requisition = reqResult.rows[0];

    if (user.role === 'requester' && requisition.owner_id !== user.id) {
      throw new ForbiddenError('You can only view your own requisitions');
    }

    const linesResult = await query(
      'SELECT * FROM line_items WHERE requisition_id = $1 ORDER BY id ASC',
      [id]
    );

    return res.json({
      ...requisition,
      total: requisition.total.toString(),
      is_overdue: Boolean(requisition.is_overdue),
      line_items: linesResult.rows.map((l) => ({
        ...l,
        unit_price: l.unit_price.toString(),
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const updateRequisitionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const parseResult = updateRequisitionSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0].message);
    }

    const reqResult = await query('SELECT * FROM requisitions WHERE id = $1', [id]);
    if (reqResult.rows.length === 0) {
      throw new NotFoundError('Requisition not found');
    }

    const existingReq = reqResult.rows[0];

    if (existingReq.owner_id !== user.id) {
      throw new ForbiddenError('Only the requisition owner can edit it');
    }

    if (existingReq.status !== 'Draft' && existingReq.status !== 'Rejected') {
      throw new ConflictError(`Cannot edit a requisition in '${existingReq.status}' status`);
    }

    const updates = parseResult.data;
    const title = updates.title ?? existingReq.title;
    const vendor_name = updates.vendor_name ?? existingReq.vendor_name;
    const department = updates.department ?? existingReq.department;
    const needed_by = updates.needed_by ?? existingReq.needed_by;

    const updateSql = `
      UPDATE requisitions 
      SET title = $1, vendor_name = $2, department = $3, needed_by = $4, updated_at = now()
      WHERE id = $5
      RETURNING *
    `;
    const result = await query(updateSql, [title, vendor_name, department, needed_by, id]);
    return res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const submitRequisitionHandler = async (
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

      const existingReq = reqResult.rows[0];

      if (existingReq.owner_id !== user.id) {
        throw new ForbiddenError('Only the requisition owner may submit it');
      }

      if (existingReq.status !== 'Draft' && existingReq.status !== 'Rejected') {
        throw new ConflictError(`Cannot submit a requisition in '${existingReq.status}' status`);
      }

      // Check for at least 1 line item
      const lineCountResult = await client.query(
        'SELECT COUNT(*) as line_count FROM line_items WHERE requisition_id = $1',
        [id]
      );
      const lineCount = parseInt(lineCountResult.rows[0].line_count, 10);
      if (lineCount === 0) {
        throw new ConflictError('Cannot submit a requisition with no line items');
      }

      // Update status to Submitted
      const updateResult = await client.query(
        "UPDATE requisitions SET status = 'Submitted', updated_at = now() WHERE id = $1 RETURNING *",
        [id]
      );
      const updatedReq = updateResult.rows[0];

      // Add timeline entry
      await addHistoryEntry({
        requisition_id: id,
        event_type: 'status_change',
        actor_id: user.id,
        old_status: existingReq.status,
        new_status: 'Submitted',
        client,
      });

      return updatedReq;
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const archiveRequisitionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const result = await query('SELECT * FROM requisitions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw new NotFoundError('Requisition not found');
    }

    await query(
      `INSERT INTO user_archived_requisitions (user_id, requisition_id, archived_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id, requisition_id) DO NOTHING`,
      [user.id, id]
    );

    await addHistoryEntry({
      requisition_id: id,
      event_type: 'comment',
      actor_id: user.id,
      reason: `Archived for ${user.email}`,
    });

    return res.json({
      ...result.rows[0],
      is_archived: true,
    });
  } catch (error) {
    next(error);
  }
};

export const restoreRequisitionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const result = await query('SELECT * FROM requisitions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw new NotFoundError('Requisition not found');
    }

    await query(
      `DELETE FROM user_archived_requisitions
       WHERE user_id = $1 AND requisition_id = $2`,
      [user.id, id]
    );

    await addHistoryEntry({
      requisition_id: id,
      event_type: 'comment',
      actor_id: user.id,
      reason: `Restored to active view for ${user.email}`,
    });

    return res.json({
      ...result.rows[0],
      is_archived: false,
    });
  } catch (error) {
    next(error);
  }
};
