export interface UserProfile {
  id: string;
  email: string;
  role: 'requester' | 'approver';
  approval_limit: number | null;
  monthly_approval_limit?: number | null;
  reports_to_id?: string | null;
  reports_to_email?: string | null;
  department?: string | null;
  title?: string | null;
  used_this_month?: number;
  remaining_monthly_limit?: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}
