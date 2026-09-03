-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('requester', 'approver')),
  approval_limit NUMERIC(12, 2) NULL,
  reports_to_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  department TEXT NULL,
  title TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_approver_limit CHECK (
    (role = 'approver' AND approval_limit IS NOT NULL AND approval_limit >= 0) OR
    (role = 'requester' AND approval_limit IS NULL)
  )
);

-- 2. requisitions table
CREATE TABLE IF NOT EXISTS requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  department TEXT NOT NULL,
  needed_by DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Ordered', 'Received')),
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. line_items table
CREATE TABLE IF NOT EXISTS line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  ordered_quantity INTEGER NOT NULL CHECK (ordered_quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0 AND received_quantity <= ordered_quantity)
);

-- 4. requisition_assigned_approvers table
CREATE TABLE IF NOT EXISTS requisition_assigned_approvers (
  requisition_id UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (requisition_id, approver_id)
);

-- 5. requisition_history table (immutable timeline)
CREATE TABLE IF NOT EXISTS requisition_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'status_change', 'receipt', 'comment')),
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  old_status TEXT NULL,
  new_status TEXT NULL,
  reason TEXT NULL,
  details JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. alert_dismissals table
CREATE TABLE IF NOT EXISTS alert_dismissals (
  requisition_id UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dismissed_needed_by DATE NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (requisition_id, approver_id)
);

-- 7. user_archived_requisitions table (per-user archiving)
CREATE TABLE IF NOT EXISTS user_archived_requisitions (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requisition_id UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, requisition_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_requisitions_status_dept_owner ON requisitions (status, department, owner_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_needed_by ON requisitions (needed_by);
CREATE INDEX IF NOT EXISTS idx_requisitions_owner_id ON requisitions (owner_id);
CREATE INDEX IF NOT EXISTS idx_line_items_requisition_id ON line_items (requisition_id);
CREATE INDEX IF NOT EXISTS idx_history_req_created ON requisition_history (requisition_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_history_event_created ON requisition_history (event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_user_archived_requisitions_user ON user_archived_requisitions(user_id);
