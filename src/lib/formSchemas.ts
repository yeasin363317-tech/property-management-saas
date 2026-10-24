import { z } from 'zod'

/** Shared validation used by sign-up, reset-password and settings forms. */
export const passwordSchema = z.string().min(8, 'At least 8 characters')
export const emailSchema = z.string().email('Enter a valid email')
