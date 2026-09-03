import { Request, Response, NextFunction } from 'express';
import { query } from '../../db';

export const exportOpenCommitmentsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sql = `
      SELECT 
        r.id,
        r.title,
        r.vendor_name,
        r.department,
        r.needed_by::text as needed_by,
        r.created_at::text as created_at,
        COALESCE(SUM(li.ordered_quantity * li.unit_price), 0)::NUMERIC(12,2) as total
      FROM requisitions r
      LEFT JOIN line_items li ON r.id = li.requisition_id
      WHERE r.status = 'Ordered' AND r.archived_at IS NULL
      GROUP BY r.id
      ORDER BY r.needed_by ASC
    `;

    const result = await query(sql);

    // Build CSV string
    const headers = ['requisition_id', 'title', 'vendor_name', 'department', 'total', 'needed_by', 'created_at'];
    const rows = result.rows.map((row) => [
      row.id,
      `"${(row.title || '').replace(/"/g, '""')}"`,
      `"${(row.vendor_name || '').replace(/"/g, '""')}"`,
      `"${(row.department || '').replace(/"/g, '""')}"`,
      row.total.toString(),
      row.needed_by,
      row.created_at,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="open-commitments.csv"');
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};
