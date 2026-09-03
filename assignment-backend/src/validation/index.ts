import { z } from 'zod';

export const createRequisitionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  vendor_name: z.string().min(1, 'Vendor name is required'),
  department: z.string().min(1, 'Department is required'),
  needed_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'needed_by must be in YYYY-MM-DD format'),
});

export const updateRequisitionSchema = createRequisitionSchema.partial();

export const updateNeededBySchema = z.object({
  needed_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'needed_by must be in YYYY-MM-DD format'),
});

export const createLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  ordered_quantity: z.number().int().min(1, 'ordered_quantity must be an integer >= 1'),
  unit_price: z.number().min(0, 'unit_price must be a number >= 0'),
});

export const updateLineItemSchema = createLineItemSchema.partial();

export const rejectRequisitionSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

export const receiptItemSchema = z.object({
  line_item_id: z.string().uuid('line_item_id must be a valid UUID'),
  quantity_received: z.number().int().min(0, 'quantity_received must be an integer >= 0'),
});

export const recordReceiptsSchema = z.object({
  receipts: z.array(receiptItemSchema).min(1, 'At least one receipt entry is required'),
});

export const bulkApproveSchema = z.object({
  requisition_ids: z.array(z.string().uuid()).min(1, 'requisition_ids array is required'),
});

export const assignApproverSchema = z.object({
  approver_id: z.string().uuid('approver_id must be a valid UUID'),
});

export const createCommentSchema = z.object({
  body: z.string().min(1, 'Comment body is required'),
});
