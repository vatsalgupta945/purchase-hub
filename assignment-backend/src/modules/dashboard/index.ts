import { Request, Response, NextFunction } from 'express';
import { query } from '../../db';

export const getDashboardHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Awaiting approval count
    const awaitingRes = await query("SELECT COUNT(*) FROM requisitions WHERE status = 'Submitted' AND archived_at IS NULL");
    const awaiting_approval = parseInt(awaitingRes.rows[0].count, 10);

    // 2. Open commitments value (total value of all requisitions currently Ordered)
    const openCommitmentsRes = await query(`
      SELECT COALESCE(SUM(li.ordered_quantity * li.unit_price), 0)::NUMERIC(12,2) as total_value
      FROM requisitions r
      JOIN line_items li ON r.id = li.requisition_id
      WHERE r.status = 'Ordered' AND r.archived_at IS NULL
    `);
    const open_commitments_value = parseFloat(openCommitmentsRes.rows[0].total_value).toFixed(2);

    // 3. Overdue count
    const overdueRes = await query(`
      SELECT COUNT(DISTINCT r.id)
      FROM requisitions r
      WHERE r.status = 'Ordered'
        AND r.needed_by < CURRENT_DATE
        AND r.archived_at IS NULL
        AND EXISTS (
          SELECT 1 FROM line_items li 
          WHERE li.requisition_id = r.id AND li.received_quantity < li.ordered_quantity
        )
    `);
    const overdue_count = parseInt(overdueRes.rows[0].count, 10);

    // 4. Received last 7 days count
    const received7DaysRes = await query(`
      SELECT COUNT(DISTINCT requisition_id)
      FROM requisition_history
      WHERE event_type = 'status_change'
        AND new_status = 'Received'
        AND created_at >= NOW() - INTERVAL '7 days'
    `);
    const received_last_7_days = parseInt(received7DaysRes.rows[0].count, 10);

    // 5. Breakdown by status
    const statusRes = await query(`
      SELECT status, COUNT(*) as count
      FROM requisitions
      WHERE archived_at IS NULL
      GROUP BY status
    `);
    const by_status: Record<string, number> = {
      Draft: 0,
      Submitted: 0,
      Approved: 0,
      Rejected: 0,
      Ordered: 0,
      Received: 0,
    };
    statusRes.rows.forEach((row) => {
      by_status[row.status] = parseInt(row.count, 10);
    });

    // 6. Breakdown by department
    const deptRes = await query(`
      SELECT department, COUNT(*) as count
      FROM requisitions
      WHERE archived_at IS NULL
      GROUP BY department
      ORDER BY count DESC
    `);
    const by_department: Record<string, number> = {};
    deptRes.rows.forEach((row) => {
      by_department[row.department] = parseInt(row.count, 10);
    });

    // 7. Received per week over last 8 weeks
    const weeklyRes = await query(`
      WITH weeks AS (
        SELECT generate_series(
          date_trunc('week', NOW() - INTERVAL '7 weeks'),
          date_trunc('week', NOW()),
          INTERVAL '1 week'
        ) AS week_start
      )
      SELECT 
        w.week_start::date::text as week_start,
        COUNT(DISTINCT h.requisition_id) as count
      FROM weeks w
      LEFT JOIN requisition_history h 
        ON h.event_type = 'status_change' 
        AND h.new_status = 'Received'
        AND h.created_at >= w.week_start 
        AND h.created_at < w.week_start + INTERVAL '1 week'
      GROUP BY w.week_start
      ORDER BY w.week_start ASC
    `);

    const received_per_week = weeklyRes.rows.map((row) => ({
      week_start: row.week_start,
      count: parseInt(row.count, 10),
    }));

    return res.json({
      awaiting_approval,
      open_commitments_value,
      overdue_count,
      received_last_7_days,
      by_status,
      by_department,
      received_per_week,
    });
  } catch (error) {
    next(error);
  }
};
