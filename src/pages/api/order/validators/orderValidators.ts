import { UserOrderStatus } from '@prisma/client';
import { z } from 'zod';

export const createOrderSchema = z.object({
  deliveryAddress: z.string().min(1, 'Delivery address is required'),
  deliveryPhone: z.string().min(1, 'Delivery phone is required'),
  notes: z.string().optional(),
  updateAddress: z.boolean().optional(),
});

export const cancelOrderSchema = z.object({
  cancellationReason: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(UserOrderStatus),
  adminNotes: z.string().optional(),
  cancellationReason: z.string().optional(),
});

export const updateAdminNotesSchema = z.object({
  adminNotes: z.string().min(1, 'Admin notes cannot be empty'),
});

// `status` accepts either one status or a comma-separated list, so a tab that
// covers several real statuses ("Ongoing" = PENDING,IN_PROGRESS) still filters
// in the `where` clause instead of after pagination has already been applied.
const orderStatusFilter = z
  .string()
  .optional()
  .transform((val, ctx) => {
    if (!val) return undefined;
    const parts = val
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const allowed = Object.values(UserOrderStatus) as string[];
    const invalid = parts.filter((part) => !allowed.includes(part));
    if (parts.length === 0 || invalid.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid order status: ${invalid.join(', ') || val}`,
      });
      return z.NEVER;
    }
    return parts.length === 1
      ? (parts[0] as UserOrderStatus)
      : (parts as UserOrderStatus[]);
  });

export const getOrdersQuerySchema = z.object({
  status: orderStatusFilter,
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
});

export const getAdminOrdersQuerySchema = z.object({
  status: z.nativeEnum(UserOrderStatus).optional(),
  searchKeyword: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
});
