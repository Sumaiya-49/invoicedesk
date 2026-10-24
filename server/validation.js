import { z } from 'zod';
import { badRequest } from './errors.js';
import { STATES } from '../src/data/seed.js';
import { GST_RATES } from '../src/lib/gst.js';

// Every request body is checked here before it reaches the database.

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const stateCode = z.string().refine((c) => STATES.some(([code]) => code === c), 'Choose a valid state');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must look like 2026-10-24');
const optText = (max) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
const gstRate = z.coerce.number().refine((r) => GST_RATES.includes(r), `GST rate must be one of ${GST_RATES.join(', ')}%`);
const gstin = z.string().trim().toUpperCase().optional().nullable()
  .transform((v) => v || null)
  .refine((v) => !v || GSTIN.test(v), 'GSTIN should be 15 characters, like 33AABCR1234K1Z5');

export const signupSchema = z.object({
  ownerName: z.string().trim().min(1, 'Enter your name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  businessName: z.string().trim().min(1, 'Enter your business name'),
  gstin,
  state: stateCode,
  address: optText(255),
}).refine((d) => !d.gstin || d.gstin.slice(0, 2) === d.state, { message: 'The first two digits of the GSTIN must match your state code' });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(150),
  email: z.string().trim().email('Enter a valid email').optional().nullable().or(z.literal('')).transform((v) => v || null),
  phone: optText(20),
  gstin,
  state: stateCode,
  city: optText(80),
}).refine((d) => !d.gstin || d.gstin.slice(0, 2) === d.state, { message: 'The first two digits of the GSTIN must match the state code' });

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(150),
  hsn: optText(10),
  unit: z.string().trim().min(1).max(20).default('Nos'),
  rate: z.coerce.number().min(0, 'Price cannot be negative'),
  gst: gstRate,
});

// Line items use the same shape as the React app: { pid, name, hsn, unit, rate, gst, qty, disc }
export const itemSchema = z.object({
  pid: z.coerce.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1, 'Every item needs a name').max(255),
  hsn: optText(10),
  unit: z.string().trim().max(20).default('Nos'),
  rate: z.coerce.number().min(0, 'Rate cannot be negative'),
  gst: gstRate,
  qty: z.coerce.number().positive('Quantity must be more than 0'),
  disc: z.coerce.number().min(0).max(100, 'Discount must be 0 to 100%').default(0),
});

const override = z.enum(['INTRA', 'INTER']).optional().nullable().transform((v) => v || null);

export const invoiceSchema = z.object({
  custId: z.coerce.number().int().positive('Choose a customer'),
  date,
  due: date.optional().nullable(),
  status: z.enum(['draft', 'sent']).default('draft'),
  override,
  notes: optText(500),
  items: z.array(itemSchema).min(1, 'Add at least one item').max(100),
});

// Paid and part-paid are set only by recording payments, never directly.
export const invoiceUpdateSchema = z.object({
  custId: z.coerce.number().int().positive().optional(),
  date: date.optional(),
  due: date.optional().nullable(),
  status: z.enum(['draft', 'sent', 'cancelled']).optional(),
  override,
  notes: optText(500),
  items: z.array(itemSchema).min(1).max(100).optional(),
});

export const paymentSchema = z.object({
  amount: z.coerce.number().positive('Enter an amount above ₹0'),
  method: z.enum(['upi', 'bank', 'cash', 'cheque', 'card']).default('upi'),
  date,
});

export const quoteSchema = z.object({
  custId: z.coerce.number().int().positive('Choose a customer'),
  date,
  valid: date,
  status: z.enum(['draft', 'sent', 'accepted']).default('draft'),
  override,
  notes: optText(500),
  items: z.array(itemSchema).min(1, 'Add at least one item').max(100),
});

export const quoteStatusSchema = z.object({ status: z.enum(['draft', 'sent', 'accepted']) });

export const creditNoteSchema = z.object({
  invNo: z.string().trim().min(1, 'Pick an invoice'),
  idx: z.coerce.number().int().min(0),
  qty: z.coerce.number().positive('Quantity must be more than 0'),
  reason: z.string().trim().min(1).max(100),
});

export const creditNoteUpdateSchema = z.object({
  qty: z.coerce.number().positive('Quantity must be more than 0').optional(),
  reason: z.string().trim().min(1).max(100).optional(),
});

export const expenseSchema = z.object({
  date,
  category: z.string().trim().min(1).max(40),
  vendor: z.string().trim().min(1, 'Add who you paid').max(150),
  amount: z.coerce.number().positive('Enter an amount above ₹0'),
  gstRate: gstRate.default(0),
});

export const settingsSchema = z.object({
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  layout: z.enum(['modern', 'classic']).optional(),
  logo: z.string().max(900_000, 'Logo is too large').nullable().optional(),
  showHsn: z.boolean().optional(),
  terms: z.string().max(1000).optional(),
  notes: z.string().max(300).optional(),
  bank: z.string().max(300).optional(),
});

export const remindSchema = z.object({ nos: z.array(z.string()).min(1).max(100) });

/** Check data against a schema; on failure send a 400 with the first problem in plain words. */
export function check(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) throw badRequest(result.error.issues[0]?.message || 'Some details are missing or invalid');
  return result.data;
}
