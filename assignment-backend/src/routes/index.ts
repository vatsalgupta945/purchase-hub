import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

import { createProfileHandler, getMeHandler, getHierarchyHandler } from '../modules/profiles';
import {
  createRequisitionHandler,
  listRequisitionsHandler,
  getRequisitionByIdHandler,
  updateRequisitionHandler,
  submitRequisitionHandler,
  archiveRequisitionHandler,
  restoreRequisitionHandler,
} from '../modules/requisitions';
import {
  createLineItemHandler,
  updateLineItemHandler,
  deleteLineItemHandler,
} from '../modules/lineItems';
import {
  approveRequisitionHandler,
  rejectRequisitionHandler,
  bulkApproveHandler,
  escalateRequisitionHandler,
} from '../modules/approvals';
import { orderRequisitionHandler, extendNeededByHandler } from '../modules/ordering';
import { recordReceiptsHandler } from '../modules/receiving';
import {
  listAssignedApproversHandler,
  assignApproverHandler,
  removeAssignedApproverHandler,
} from '../modules/assignedApprovers';
import { createCommentHandler } from '../modules/comments';
import { getTimelineHandler } from '../modules/timeline';
import { listAlertsHandler, dismissAlertHandler } from '../modules/alerts';
import { getDashboardHandler } from '../modules/dashboard';
import { exportOpenCommitmentsHandler } from '../modules/exports';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Authenticated routes
router.use(authMiddleware);

// Profile
router.get('/me', getMeHandler);
router.get('/approvers/hierarchy', getHierarchyHandler);
router.post('/profiles', createProfileHandler);

// Dashboard
router.get('/dashboard', getDashboardHandler);

// Alerts (Approver only)
router.get('/alerts', requireRole('approver'), listAlertsHandler);
router.post('/alerts/:requisitionId/dismiss', requireRole('approver'), dismissAlertHandler);

// Specific Requisition routes (placed BEFORE :id parameter matching)
router.get('/requisitions/export/open-commitments', requireRole('approver'), exportOpenCommitmentsHandler);
router.post('/requisitions/bulk-approve', requireRole('approver'), bulkApproveHandler);

// Requisition collection routes
router.post('/requisitions', requireRole('requester'), createRequisitionHandler);
router.get('/requisitions', listRequisitionsHandler);

// Requisition individual resource routes
router.get('/requisitions/:id', getRequisitionByIdHandler);
router.patch('/requisitions/:id', requireRole('requester'), updateRequisitionHandler);
router.patch('/requisitions/:id/needed-by', requireRole('approver'), extendNeededByHandler);
router.post('/requisitions/:id/submit', requireRole('requester'), submitRequisitionHandler);
router.post('/requisitions/:id/archive', archiveRequisitionHandler);
router.post('/requisitions/:id/restore', restoreRequisitionHandler);

// Approvals & Ordering (Approver only)
router.post('/requisitions/:id/approve', requireRole('approver'), approveRequisitionHandler);
router.post('/requisitions/:id/reject', requireRole('approver'), rejectRequisitionHandler);
router.post('/requisitions/:id/escalate', requireRole('approver'), escalateRequisitionHandler);
router.post('/requisitions/:id/order', requireRole('approver'), orderRequisitionHandler);
router.post('/requisitions/:id/receipts', requireRole('approver'), recordReceiptsHandler);

// Line Items (Requester only)
router.post('/requisitions/:id/line-items', requireRole('requester'), createLineItemHandler);
router.patch('/requisitions/:id/line-items/:lineId', requireRole('requester'), updateLineItemHandler);
router.delete('/requisitions/:id/line-items/:lineId', requireRole('requester'), deleteLineItemHandler);

// Assigned Approvers
router.get('/requisitions/:id/approvers', listAssignedApproversHandler);
router.post('/requisitions/:id/approvers', requireRole('approver'), assignApproverHandler);
router.delete('/requisitions/:id/approvers/:approverId', requireRole('approver'), removeAssignedApproverHandler);

// Timeline & Comments
router.get('/requisitions/:id/timeline', getTimelineHandler);
router.post('/requisitions/:id/comments', createCommentHandler);

export default router;
