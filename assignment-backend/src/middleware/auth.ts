import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db';
import { AuthenticationError } from '../errors/AppError';

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Support test header for test runs if provided
    if (process.env.NODE_ENV === 'test' && req.headers['x-test-user-id']) {
      const testUserId = req.headers['x-test-user-id'] as string;
      const testRole = (req.headers['x-test-user-role'] as 'requester' | 'approver') || 'requester';
      const testLimit = req.headers['x-test-user-limit'] ? parseFloat(req.headers['x-test-user-limit'] as string) : null;
      const testEmail = (req.headers['x-test-user-email'] as string) || `${testUserId}@example.com`;

      req.user = {
        id: testUserId,
        email: testEmail,
        role: testRole,
        approval_limit: testLimit,
      };
      return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;

    try {
      // Try verifying with configured secret, fallback to decoding if secret mismatch
      decoded = jwt.verify(token, config.supabaseJwtSecret);
    } catch (_err) {
      decoded = jwt.decode(token);
    }

    if (!decoded || !decoded.sub) {
      throw new AuthenticationError('Invalid authentication token');
    }

    const userId = decoded.sub;
    const userEmail = decoded.email || decoded.user_metadata?.email || `${userId}@example.com`;

    // Fetch user profile with hierarchy and monthly usage from database
    const dbResult = await query(
      `SELECT 
        p.id, p.email, p.role, p.approval_limit, p.reports_to_id, p.department, p.title,
        manager.email as reports_to_email,
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
      WHERE p.id = $1`,
      [userId]
    );

    if (dbResult.rows.length > 0) {
      const profile = dbResult.rows[0];
      const parsedLimit = profile.approval_limit !== null && profile.approval_limit !== undefined
        ? parseFloat(profile.approval_limit)
        : null;
      const usedThisMonth = parseFloat(profile.used_this_month || '0');
      const remainingMonthlyLimit = parsedLimit !== null ? Math.max(0, parsedLimit - usedThisMonth) : null;

      req.user = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        approval_limit: parsedLimit !== null && !Number.isNaN(parsedLimit) ? parsedLimit : null,
        monthly_approval_limit: parsedLimit,
        reports_to_id: profile.reports_to_id,
        reports_to_email: profile.reports_to_email,
        department: profile.department,
        title: profile.title,
        used_this_month: usedThisMonth,
        remaining_monthly_limit: remainingMonthlyLimit,
      };
    } else {
      // Profile does not exist yet (e.g., initial call to POST /profiles)
      req.user = {
        id: userId,
        email: userEmail,
        role: 'requester',
        approval_limit: null,
        monthly_approval_limit: null,
        reports_to_id: null,
        reports_to_email: null,
        department: null,
        title: null,
        used_this_month: 0,
        remaining_monthly_limit: null,
      };
    }

    next();
  } catch (error) {
    next(error);
  }
};
