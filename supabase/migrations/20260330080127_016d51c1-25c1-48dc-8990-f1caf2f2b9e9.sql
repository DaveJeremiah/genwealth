CREATE TABLE public.wish_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_name text NOT NULL,
  description text,
  estimated_price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'UGX',
  estimated_ugx_amount numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Other',
  priority text NOT NULL DEFAULT 'want_it',
  target_date text,
  purchased boolean NOT NULL DEFAULT false,
  actual_amount_paid numeric,
  actual_currency text,
  purchase_date text,
  actual_ugx_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wish_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wish list items"
  ON public.wish_list_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wish list items"
  ON public.wish_list_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wish list items"
  ON public.wish_list_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wish list items"
  ON public.wish_list_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);