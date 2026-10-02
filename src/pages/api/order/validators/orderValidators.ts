import {
  DELIVERY_METHODS,
  isPickupAddress,
  PICKUP_ADDRESS,
} from '@/pages/lib/orderDelivery';
import { normalizePhone } from '@/pages/lib/phone';
import { UserOrderStatus } from '@prisma/client';
import { z } from 'zod';

export const deliveryPhoneSchema = z.string().transform((val, ctx) => {
  const normalized = normalizePhone(val);
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid delivery phone',
    });
    return z.NEVER;
  }
  return normalized;
});

const orderDeliveryFields = {
  deliveryMethod: z.enum(DELIVERY_METHODS).default('DELIVERY'),
  deliveryAddress: z.string().trim().optional(),
  deliveryPhone: deliveryPhoneSchema,
  notes: z.string().optional(),
};

const withDeliveryRules = <T extends z.ZodRawShape>(extra: T) =>
  z
    .object({ ...orderDeliveryFields, ...extra })
    .superRefine((val, ctx) => {
      if (val.deliveryMethod !== 'DELIVERY') return;
      if (!val.deliveryAddress) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deliveryAddress'],
          message: 'Delivery address is required',
        });
      } else if (isPickupAddress(val.deliveryAddress)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deliveryAddress'],
          message: 'Invalid delivery address',
        });
      }
    })
    .transform((val) => ({
      ...val,
      deliveryAddress:
        val.deliveryMethod === 'PICKUP'
          ? PICKUP_ADDRESS
          : (val.deliveryAddress as string),
    }));

export const createOrderSchema = withDeliveryRules({
  updateAddress: z.boolean().optional(),
});

export const createGuestOrderSchema = withDeliveryRules({
  userName: z.string().optional(),
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

export const updateDeliveryPriceSchema = z.object({
  deliveryPrice: z.coerce
    .number()
    .finite()
    .min(0, 'Delivery price cannot be negative'),
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
