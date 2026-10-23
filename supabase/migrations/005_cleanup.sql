-- Removes a no-op constraint that 001 originally created by mistake.
alter table public.invoice_adjustments drop constraint if exists invoice_adjustments_no_blank;
