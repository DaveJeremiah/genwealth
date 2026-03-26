ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS ugx_amount numeric NOT NULL DEFAULT 0;

-- Backfill existing data: assume existing USD amounts, convert at ~3750 UGX/USD
UPDATE public.transactions SET ugx_amount = amount * 3750 WHERE ugx_amount = 0 AND currency = 'USD';
-- For non-USD existing data, just use amount as placeholder
UPDATE public.transactions SET ugx_amount = amount WHERE ugx_amount = 0;