import { Request, Response, NextFunction } from 'express';
import { query } from '../../db';

export const getDashboardHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const userId = user?.id;
    const isRequester = user?.role === 'requester';

    const userParam = userId ? [userId] : [];
    const archiveCondition = userId
      ? `AND NOT EXISTS (SELECT 1 FROM user_archived_requisitions uar WHERE uar.requisition_id = r.id AND uar.user_id = $1)`
      : '';
    const requesterCondition = isRequester && userId
      ? `AND r.owner_id = $1`
      : '';

    // 1. Awaiting approval count (Submitted requisitions)
    const awaitingSql = `
      SELECT COUNT(*) 
      FROM requisitions r 
      WHERE r.status = 'Submitted' 
        ${archiveCondition} 
        ${requesterCondition}
    `;
    const awaitingRes = await query(awaitingSql, userParam);
    const awaiting_approval = parseInt(awaitingRes.rows[0]?.count || '0', 10);

    // 2. Open commitments value (unfulfilled remaining value of all requisitions currently Ordered)
    const openCommitmentsSql = `
      SELECT COALESCE(SUM((li.ordered_quantity - li.received_quantity) * li.unit_price), 0)::NUMERIC(12,2) as total_value
      FROM requisitions r
      JOIN line_items li ON r.id = li.requisition_id
      WHERE r.status = 'Ordered'
        AND li.received_quantity < li.ordered_quantity
        ${archiveCondition} 
        ${requesterCondition}
    `;
    const openCommitmentsRes = await query(openCommitmentsSql, userParam);
    const open_commitments_value = parseFloat(openCommitmentsRes.rows[0]?.total_value || '0').toFixed(2);

    // 3. Overdue count (Submitted, Approved, or Ordered past needed_by date)
    const overdueSql = `
      SELECT COUNT(DISTINCT r.id)
      FROM requisitions r
      WHERE r.status IN ('Submitted', 'Approved', 'Ordered')
        AND r.needed_by < CURRENT_DATE
        AND (
          r.status IN ('Submitted', 'Approved') OR EXISTS (
            SELECT 1 FROM line_items li 
            WHERE li.requisition_id = r.id AND li.received_quantity < li.ordered_quantity
          )
        )
        ${archiveCondition}
        ${requesterCondition}
    `;
    const overdueRes = await query(overdueSql, userParam);
    const overdue_count = parseInt(overdueRes.rows[0]?.count || '0', 10);

    // 4. Received last 7 days count
    const received7DaysRes = await query(`
      SELECT COUNT(DISTINCT requisition_id)
      FROM requisition_history
      WHERE event_type = 'status_change'
        AND new_status = 'Received'
        AND created_at >= NOW() - INTERVAL '7 days'
    `);
    const received_last_7_days = parseInt(received7DaysRes.rows[0]?.count || '0', 10);

    // 5. Breakdown by status
    const statusSql = `
      SELECT r.status, COUNT(*) as count
      FROM requisitions r
      WHERE 1=1
        ${archiveCondition}
        ${requesterCondition}
      GROUP BY r.status
    `;
    const statusRes = await query(statusSql, userParam);
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
    const deptSql = `
      SELECT r.department, COUNT(*) as count
      FROM requisitions r
      WHERE 1=1
        ${archiveCondition}
        ${requesterCondition}
      GROUP BY r.department
      ORDER BY count DESC
    `;
    const deptRes = await query(deptSql, userParam);
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
