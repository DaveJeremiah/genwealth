-- Wish list (excluded from financial calcs until marked purchased)
CREATE TABLE public.wish_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  estimated_price NUMERIC(24, 8) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UGX',
  estimated_ugx_amount NUMERIC(24, 2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('nice_to_have', 'want_it', 'need_it')),
  target_date DATE,
  purchased BOOLEAN NOT NULL DEFAULT FALSE,
  actual_amount_paid NUMERIC(24, 8),
  actual_currency TEXT,
  purchase_date DATE,
  actual_ugx_amount NUMERIC(24, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX wish_list_items_user_id_idx ON public.wish_list_items (user_id);
CREATE INDEX wish_list_items_user_purchased_idx ON public.wish_list_items (user_id, purchased);

ALTER TABLE public.wish_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wish list" ON public.wish_list_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wish list" ON public.wish_list_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wish list" ON public.wish_list_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own wish list" ON public.wish_list_items FOR DELETE USING (auth.uid() = user_id);
