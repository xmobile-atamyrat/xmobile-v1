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

export const getOrdersQuerySchema = z.object({
  status: z.nativeEnum(UserOrderStatus).optional(),
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
